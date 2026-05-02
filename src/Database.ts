/**
 * @fileoverview Módulo de Base de Datos Transaccional - Almacén de Víveres.
 * @author Antigravity
 */

const DB_ALMV_ID = '1cAy768H0tWJlbb_6zUBr8bH36tKd_iv1csJxwxAI7YU';
const CATALOG_CACHE_KEY = 'adjudicados_catalog_json';

/**
 * Obtiene el catálogo de artículos adjudicados desde la base de datos.
 * Utiliza un patrón de lotes y almacenamiento en caché segmentado para optimizar el rendimiento.
 * 
 * @returns {Array<Object>} Arreglo de objetos con los datos de los artículos.
 */
function getAdjudicadosCatalog() {
  const cachedData = getLargeCache(CATALOG_CACHE_KEY);
  
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      console.warn("Error parseando caché segmentado, recargando...");
    }
  }

  try {
    const ss = SpreadsheetApp.openById(DB_ALMV_ID);
    const sheet = ss.getSheetByName('Adjudicados');
    
    if (!sheet) {
      throw new Error("ERROR: La hoja Adjudicados no existe en el archivo BD-ALMV.");
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const rows = data.slice(1);

    const catalog = rows.map(row => {
      return {
        id_adjudicado: row[0] || '',
        id_contrato: row[1] || '',
        familia: (row[2] || '').toString().toUpperCase().trim(),
        codigo: (row[3] || '').toString(),
        descripcion: (row[4] || '').toString().replace(/"/g, '\"'), // Escapar comillas
        unidad_medida: row[5] || 'PZA',
        precio_unitario: Number(row[6] || 0),
        faa_max: Number(row[8] || 0),
        jim_max: Number(row[10] || 0),
        hco_max: Number(row[12] || 0),
        opd_max: Number(row[14] || 0),
        total_max: Number(row[16] || 0)
      };
    });


    // Guardar en caché segmentado por 1 hora (3600 segundos)
    setLargeCache(CATALOG_CACHE_KEY, JSON.stringify(catalog), 3600);

    
    return catalog;
  } catch (err) {
    console.error("Error al obtener catálogo de adjudicados:", err);
    return [];
  }
}

/**
 * Almacena un valor grande en el caché dividiéndolo en fragmentos.
 * Resuelve el error "Argument too large: value" de CacheService (límite 100KB).
 */
function setLargeCache(key, value, expiration) {
  const cache = CacheService.getScriptCache();
  const chunkSize = 90 * 1024; // 90KB por seguridad
  const chunks = [];
  
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
 */
function getLargeCache(key) {
  const cache = CacheService.getScriptCache();
  const chunkCount = cache.get(`${key}_count`);
  if (!chunkCount) return null;
  
  let value = '';
  for (let i = 0; i < parseInt(chunkCount); i++) {
    const chunk = cache.get(`${key}_${i}`);
    if (!chunk) return null; // Falló la integridad del caché
    value += chunk;
  }
  return value;
}

/**
 * Interface JSDoc para referencia de datos:
 * @typedef {Object} Adjudicado
 * @property {string} id_adjudicado
 * @property {string} familia
 * @property {string} codigo
 * @property {string} descripcion
 * @property {string} unidad_medida
 * @property {number} total_max
 * @property {number} faa_max
 * @property {number} jim_max
 * @property {number} hco_max
 */

