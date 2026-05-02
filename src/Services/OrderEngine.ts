/**
 * @fileoverview Motor de Cálculo de Pedidos (Algoritmo de Requisición).
 * Convierte cantidades solicitadas netas en unidades comerciales enteras,
 * aplicando factores de merma por categoría.
 */

// ─── Interfaces de Dominio ─────────────────────────────────────────────────────

/** Solicitud individual de insumo desde el frontend. */
interface SolicitudRequisicion {
  codigo: string;
  cantidadSolicitada: number;
}

/** Resultado del cálculo de requisición para un insumo individual. */
interface ResultadoRequisicion {
  codigo: string;
  id_contrato?: string;
  descripcion?: string;
  unidad?: string;
  cantidadSolicitada?: number;
  factorAplicado?: number;
  cantidadNeta?: number;
  unidadesComerciales?: number;
  desperdicioEstimado?: number;
  limiteMaximo?: number;
  alertaExceso?: boolean;
  costoEstimado?: number;
  error?: string;
  mensaje?: string;
}

/** Mapa de factores de merma por familia de insumo. */
interface FactoresMerma {
  [familia: string]: number;
}

// ─── Declaraciones Cross-File (GAS Namespace Global) ────────────────────────────

/**
 * Referencia declarativa a la función definida en Database.ts.
 * En el runtime de GAS, todas las funciones de nivel superior comparten
 * el mismo namespace global, por lo que esta declaración solo sirve
 * para informar al compilador de TypeScript.
 */
declare function getAdjudicadosCatalog(forceRefresh?: boolean): Adjudicado[];
declare function isAuthorized(): boolean;

// ─── Motor de Cálculo ───────────────────────────────────────────────────────────

/**
 * Calcula la requisición de orden aplicando factores de merma clínicos.
 *
 * @param solicitudes - Array de solicitudes con código e cantidad solicitada.
 * @returns Array de resultados procesados con unidades comerciales calculadas.
 */
function calculateOrderRequisition(solicitudes: SolicitudRequisicion[]): ResultadoRequisicion[] {
  if (!isAuthorized()) throw new Error("Unauthorized");

  const FACTORES_MERMA: FactoresMerma = {
    'ABARROTES': 1.05,
    'CARNES': 1.10,
    'FRUTAS Y VERDURAS': 1.15,
    'LACTEOS': 1.03,
    'ACEITES, ADEREZOS Y SALSAS': 1.02,
    'DEFAULT': 1.05
  };

  const catalog: Adjudicado[] = getAdjudicadosCatalog();
  const resultados: ResultadoRequisicion[] = [];

  solicitudes.forEach((req: SolicitudRequisicion) => {
    const insumo = catalog.find((i: Adjudicado) => i.codigo === req.codigo);
    if (!insumo) {
      resultados.push({ codigo: req.codigo, error: 'INSUMO_NO_ENCONTRADO' });
      return;
    }

    const familiaNormalizada = (insumo.familia || '').toUpperCase().trim();
    const factor = FACTORES_MERMA[familiaNormalizada] || FACTORES_MERMA['DEFAULT'];

    // Algoritmo CEILING de NutriCare
    const cantidadNeta = req.cantidadSolicitada * factor;
    const unidadesComerciales = Math.ceil(cantidadNeta); // Redondeo siempre hacia arriba
    const desperdicioEstimado = unidadesComerciales - cantidadNeta;

    if (unidadesComerciales > insumo.cantidad_disponible) {
      resultados.push({
        codigo: insumo.codigo,
        id_contrato: insumo.id_contrato,
        descripcion: insumo.descripcion,
        error: 'STOCK_INSUFICIENTE',
        mensaje: `Sobregiro: Se requieren ${unidadesComerciales} unidades, pero solo hay ${insumo.cantidad_disponible} disponibles en el contrato ${insumo.id_contrato}.`
      });
      return; // Detiene el procesamiento de esta línea, se marca como inválida
    }

    resultados.push({
      codigo: insumo.codigo,
      id_contrato: insumo.id_contrato,
      descripcion: insumo.descripcion,
      unidad: insumo.unidad_medida,
      cantidadSolicitada: Number(req.cantidadSolicitada),
      factorAplicado: factor,
      cantidadNeta: Number(cantidadNeta.toFixed(2)),
      unidadesComerciales: unidadesComerciales, // Esto es lo que sale del almacén
      desperdicioEstimado: Number(desperdicioEstimado.toFixed(2)),
      limiteMaximo: insumo.cantidad_disponible,
      alertaExceso: unidadesComerciales > insumo.cantidad_disponible,
      costoEstimado: unidadesComerciales * insumo.precio_unitario
    });
  });

  return resultados;
}
