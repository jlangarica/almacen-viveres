/**
 * @fileoverview Motor de Cálculo de Pedidos (Algoritmo de Requisición).
 * Convierte cantidades solicitadas netas en unidades comerciales enteras,
 * aplicando factores de merma por categoría.
 */

/**
 * Calcula la requisición de orden
 * @param {Array} solicitudes - Array de solicitudes de pedidos
 * @returns {Array} Resultados procesados
 */
function calculateOrderRequisition(solicitudes) {
  if (!isAuthorized()) throw new Error("Unauthorized");
  // Factores de merma extraídos de la especificación clínica
  const FACTORES_MERMA = {
    'ABARROTES': 1.05,
    'CARNES': 1.10,
    'FRUTAS Y VERDURAS': 1.15,
    'LACTEOS': 1.03,
    'ACEITES, ADEREZOS Y SALSAS': 1.02,
    'DEFAULT': 1.05
  };

  // Obtener el catálogo desde la función existente en Database.ts
  // @ts-ignore - Definida en otro archivo de GAS
  const catalog = getAdjudicadosCatalog(); 
  const resultados = [];

  solicitudes.forEach(req => {
    const insumo = catalog.find(i => i.codigo === req.codigo);
    if (!insumo) {
      resultados.push({ codigo: req.codigo, error: 'INSUMO_NO_ENCONTRADO' });
      return;
    }

    const familiaNormalizada = (insumo.familia || '').toUpperCase().trim();
    const factor = FACTORES_MERMA[familiaNormalizada] || FACTORES_MERMA.DEFAULT;
    
    // Algoritmo CEILING de NutriCare
    const cantidadNeta = req.cantidadSolicitada * factor;
    const unidadesComerciales = Math.ceil(cantidadNeta); // Redondeo siempre hacia arriba
    const desperdicioEstimado = unidadesComerciales - cantidadNeta;

    resultados.push({
      codigo: insumo.codigo,
      descripcion: insumo.descripcion,
      unidad: insumo.unidad_medida,
      cantidadSolicitada: Number(req.cantidadSolicitada),
      factorAaplicado: factor,
      cantidadNeta: Number(cantidadNeta.toFixed(2)),
      unidadesComerciales: unidadesComerciales, // Esto es lo que sale del almacén
      desperdicioEstimado: Number(desperdicioEstimado.toFixed(2)),
      limiteMaximo: insumo.total_max,
      alertaExceso: unidadesComerciales > insumo.total_max
    });
  });

  return resultados;
}
