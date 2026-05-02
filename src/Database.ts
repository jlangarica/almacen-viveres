/**
 * @fileoverview Módulo de Base de Datos Transaccional - Almacén de Víveres.
 * @author Antigravity
 */

const DB_ALMV_ID = '1cAy768H0tWJlbb_6zUBr8bH36tKd_iv1csJxwxAI7YU';
const CATALOG_CACHE_KEY = 'adjudicados_catalog_json';

// ─── Interfaces de Dominio ─────────────────────────────────────────────────────

/** Representa un artículo adjudicado del catálogo de compras. */
interface Adjudicado {
  id_adjudicado: string;
  id_contrato: string;
  familia: string;
  codigo: string;
  descripcion: string;
  unidad_medida: string;
  precio_unitario: number;
  faa_max: number;
  jim_max: number;
  hco_max: number;
  opd_max: number;
  total_max: number;
  // --- NUEVAS COLUMNAS DE CONTROL ---
  cantidad_consumida: number;
  cantidad_disponible: number;
  cantidad_ampliada: number;
  importe_consumido: number;
  importe_disponible: number;
  porcentaje_disponible: number;
}

/** Artículo individual dentro del payload de un pedido entrante. */
interface PedidoArticulo {
  codigo: string;
  id_contrato: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadesComerciales: number;
  costoEstimado?: number;
}

interface PedidoData {
  lineas: PedidoArticulo[];
}

// ─── Funciones de Caché Segmentado ──────────────────────────────────────────────

/**
 * Almacena un valor grande en el caché dividiéndolo en fragmentos.
 * Resuelve el error "Argument too large: value" de CacheService (límite 100KB).
 *
 * @param key - Clave base para los fragmentos.
 * @param value - Cadena JSON completa a almacenar.
 * @param expiration - TTL en segundos para cada fragmento.
 */
function setLargeCache(key: string, value: string, expiration: number): void {
  const cache = CacheService.getScriptCache();
  const chunkSize = 90 * 1024; // 90KB por seguridad
  const chunks: string[] = [];

  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.substring(i, i + chunkSize));
  }

  cache.put(`${key}_count`, chunks.length.toString(), expiration);
  chunks.forEach((chunk, index) => {
    cache.put(`${key}_${index}`, chunk, expiration);
  });
}

/**
 * Recupera y ensambla un valor grande dividido en fragmentos desde el caché.
 *
 * @param key - Clave base utilizada al almacenar.
 * @returns La cadena completa reensamblada, o null si el caché expiró o está corrupto.
 */
function getLargeCache(key: string): string | null {
  const cache = CacheService.getScriptCache();
  const chunkCount = cache.get(`${key}_count`);
  if (!chunkCount) return null;

  let value = '';
  for (let i = 0; i < parseInt(chunkCount, 10); i++) {
    const chunk = cache.get(`${key}_${i}`);
    if (!chunk) return null; // Falló la integridad del caché
    value += chunk;
  }
  return value;
}

// ─── Funciones Públicas (Endpoints RPC) ─────────────────────────────────────────

/**
 * Obtiene el catálogo de artículos adjudicados desde la base de datos.
 * Utiliza un patrón de lotes y almacenamiento en caché segmentado para optimizar el rendimiento.
 *
 * @param forceRefresh - Si es true, invalida el caché y consulta la hoja directamente.
 * @returns Arreglo de objetos con los datos de los artículos.
 */
function getAdjudicadosCatalog(forceRefresh: boolean = false): Adjudicado[] {
  if (!isAuthorized()) throw new Error("Unauthorized");

  if (!forceRefresh) {
    const cachedData = getLargeCache(CATALOG_CACHE_KEY);

    if (cachedData) {
      try {
        return JSON.parse(cachedData) as Adjudicado[];
      } catch (e) {
        console.warn("Error parseando caché segmentado, recargando...");
      }
    }
  }

  try {
    const ss = SpreadsheetApp.openById(DB_ALMV_ID);
    const sheet = ss.getSheetByName('Adjudicados');

    if (!sheet) {
      throw new Error("ERROR: La hoja Adjudicados no existe en el archivo BD-ALMV.");
    }

    const data: unknown[][] = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const rows = data.slice(1);

    const catalog: Adjudicado[] = rows.map((row): Adjudicado | null => {
      if (!row[3] && !row[4]) return null;

      return {
        id_adjudicado: String(row[0] || ''),
        id_contrato: String(row[1] || ''),
        familia: String(row[2] || 'SIN FAMILIA').toUpperCase().trim(),
        codigo: String(row[3] || 'N/A'),
        descripcion: String(row[4] || 'Sin descripción').replace(/"/g, '\\"'),
        unidad_medida: String(row[5] || 'PZA'),
        precio_unitario: Number(row[6] || 0),
        faa_max: Number(row[8] || 0),
        jim_max: Number(row[10] || 0),
        hco_max: Number(row[12] || 0),
        opd_max: Number(row[14] || 0),
        total_max: Number(row[16] || 0),
        // --- NUEVAS COLUMNAS DE CONTROL ---
        cantidad_consumida: Number(row[17] || 0),
        cantidad_disponible: Number(row[18] || 0),
        cantidad_ampliada: Number(row[22] || 0),
        importe_consumido: Number(row[23] || 0),
        importe_disponible: Number(row[24] || 0),
        porcentaje_disponible: Number(row[25] || 0)
      };
    }).filter((item): item is Adjudicado => item !== null);

    // Guardar en caché segmentado por 1 hora (3600 segundos)
    setLargeCache(CATALOG_CACHE_KEY, JSON.stringify(catalog), 3600);

    return catalog;
  } catch (err) {
    console.error("Error al obtener catálogo de adjudicados:", err);
    return [];
  }
}

/**
 * Guarda un pedido en la base de datos con generación de folio atómico y bloqueo de seguridad.
 *
 * @param articulos - Lista de artículos calculados para el pedido.
 * @returns El folio generado para el pedido.
 */
function savePedido(articulos: PedidoArticulo[]): string {
  if (!isAuthorized()) throw new Error("Unauthorized");
  const lock = LockService.getScriptLock();
  try {
    // Intentar obtener el bloqueo por 10 segundos para evitar duplicidad de folios
    if (lock.tryLock(10000)) {
      const ss = SpreadsheetApp.openById(DB_ALMV_ID);
      let sheet = ss.getSheetByName('Pedidos');

      // Crear la hoja si no existe
      if (!sheet) {
        sheet = ss.insertSheet('Pedidos');
        const headers = ['Folio', 'Fecha', 'Usuario', 'Codigo', 'Descripcion', 'Cantidad_Solicitada', 'Unidades_Comerciales', 'Estatus'];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#efefef');
        sheet.setFrozenRows(1);
      }

      const lastRow = sheet.getLastRow();
      const props = PropertiesService.getScriptProperties();
      const currentIdStr = props.getProperty('LAST_PEDIDO_ID') || '0';
      const nextId = parseInt(currentIdStr, 10) + 1;
      const folio = 'PED-' + nextId.toString().padStart(3, '0');
      props.setProperty('LAST_PEDIDO_ID', nextId.toString());
      const fecha = new Date();
      const usuario = Session.getActiveUser().getEmail();

      // Preparar matriz para setValues (Batch writing)
      const values: unknown[][] = articulos.map((art): unknown[] => [
        folio,
        fecha,
        usuario,
        art.codigo,
        art.descripcion,
        art.cantidadSolicitada,
        art.unidadesComerciales,
        'PENDIENTE'
      ]);

      // Escribir en bloque
      sheet.getRange(lastRow + 1, 1, values.length, 8).setValues(values);

      // Auditoría en Cloud Logging
      console.log(JSON.stringify({
        event: 'PEDIDO_GUARDADO_EXITO',
        folio: folio,
        usuario: usuario,
        itemsCount: values.length,
        timestamp: fecha.toISOString()
      }));

      return folio;
    } else {
      throw new Error("No se pudo obtener el bloqueo del script (timeout).");
    }
  } catch (err) {
    console.error("Error en savePedido:", err);
    throw new Error("Error crítico al guardar pedido: " + (err as Error).message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda el pedido y actualiza el consumo en la BD usando la llave [codigo + id_contrato]
 * @param pedidoData - Contiene array de lineas aprobadas
 */
function savePedidoAndUpdateStock(pedidoData: PedidoData): { exito: boolean; folio: string } {
  if (!isAuthorized()) throw new Error("Unauthorized");
  
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("Sistema ocupado, intenta en 15 seg.");

  try {
    const ss = SpreadsheetApp.openById(DB_ALMV_ID);
    const sheetAdjudicados = ss.getSheetByName('Adjudicados');
    
    if (!sheetAdjudicados) throw new Error("Hoja Adjudicados no encontrada.");

    // 1. Leer toda la base de datos en memoria (Patrón Batch)
    const data = sheetAdjudicados.getDataRange().getValues();
    let stockActualizado = false;

    // 2. Procesar cada línea del pedido contra la matriz en memoria
    pedidoData.lineas.forEach(linea => {
      // Buscar la fila exacta por Código (Índice 3) y Contrato (Índice 1)
      const rowIndex = data.findIndex(row => row[3] == linea.codigo && row[1] == linea.id_contrato);
      
      if (rowIndex !== -1) {
        // Actualizar cantidad_consumida (Columna R, Índice 17)
        const consumoAnterior = Number(data[rowIndex][17] || 0);
        data[rowIndex][17] = consumoAnterior + linea.unidadesComerciales;
        stockActualizado = true;
      } else {
        throw new Error(`Inconsistencia: No se encontró el cruce de Código ${linea.codigo} y Contrato ${linea.id_contrato}`);
      }
    });

    // 3. Escribir los cambios de stock de una sola vez
    if (stockActualizado) {
      sheetAdjudicados.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    // 4. Guardar el registro del pedido en la hoja 'Pedidos' (Crear hoja si no existe)
    let sheetPedidos = ss.getSheetByName('Pedidos');
    if (!sheetPedidos) {
      sheetPedidos = ss.insertSheet('Pedidos');
    }
    
    if (sheetPedidos.getLastRow() === 0) {
      sheetPedidos.appendRow(['Folio', 'Fecha', 'Usuario', 'Codigo', 'Contrato', 'Unidades', 'Costo']);
      sheetPedidos.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#efefef');
      sheetPedidos.setFrozenRows(1);
    }
    
    const props = PropertiesService.getScriptProperties();
    const currentIdStr = props.getProperty('LAST_PEDIDO_ID') || '0';
    const nextId = parseInt(currentIdStr, 10) + 1;
    const folio = 'PED-' + nextId.toString().padStart(3, '0');
    props.setProperty('LAST_PEDIDO_ID', nextId.toString());
    
    const usuario = Session.getActiveUser().getEmail();
    const fecha = new Date();

    const filasPedido: unknown[][] = pedidoData.lineas.map(l => [
      folio, fecha, usuario, 
      l.codigo, l.id_contrato, l.unidadesComerciales, l.costoEstimado || 0
    ]);
    
    sheetPedidos.getRange(sheetPedidos.getLastRow() + 1, 1, filasPedido.length, 7).setValues(filasPedido);

    return { exito: true, folio: folio };

  } finally {
    lock.releaseLock();
    CacheService.getScriptCache().remove(CATALOG_CACHE_KEY); // Invalidar caché
  }
}
