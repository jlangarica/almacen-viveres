/**
 * @fileoverview Declaraciones globales para el namespace compartido de GAS.
 * En Google Apps Script, todas las funciones de nivel superior de todos los archivos
 * comparten un único namespace global. Este archivo le informa al compilador de
 * TypeScript sobre esas referencias cruzadas.
 */

// ─── Auth.ts Exports ────────────────────────────────────────────────────────────

declare function isAuthorized(): boolean;
declare function isUserAuthorized(email: string): boolean;
declare function getUserEmail(): string;

// ─── Database.ts Exports ────────────────────────────────────────────────────────

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
}

/** Artículo individual dentro del payload de un pedido entrante. */
interface PedidoArticulo {
  codigo: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadesComerciales: number;
}

declare function getAdjudicadosCatalog(forceRefresh?: boolean): Adjudicado[];
declare function savePedido(articulos: PedidoArticulo[]): string;
declare function setLargeCache(key: string, value: string, expiration: number): void;
declare function getLargeCache(key: string): string | null;

// ─── Main.ts Exports ────────────────────────────────────────────────────────────

declare function include(filename: string): string;
declare function getModuleContent(moduleName: string): string;
