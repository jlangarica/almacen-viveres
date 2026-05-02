/**
 * @fileoverview Main entry point for the Google Apps Script Web App.
 * @author Antigravity
 */

/**
 * Serves the HTML content when the Web App URL is accessed.
 *
 * @param e - HTTP request event object from Apps Script runtime.
 * @returns The HTML output to serve.
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  const authorized = isAuthorized();

  const template = authorized ? 'ui/Index' : 'ui/AccessDenied';

  return HtmlService.createTemplateFromFile(template)
    .evaluate()
    .setTitle('Almacén de Víveres - HCG')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Includes the content of a file into the current template.
 * Used for including CSS and JS from separate HTML files via `<?!= include('file'); ?>`.
 *
 * @param filename - The name of the file to include (relative to src/).
 * @returns The raw HTML content of the file.
 */
function include(filename: string): string {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Whitelist of valid module names for the SPA router. */
const ALLOWED_MODULES: ReadonlySet<string> = new Set([
  'Dashboard',
  'Almacenes',
  'Pedidos',
  'OrdenesCompra',
  'Entradas',
  'Salidas',
  'Contratos',
  'Pacientes',
  'Servicios',
  'Proveedores',
  'Recepciones'
]);

/**
 * Returns an HTML fragment for a specific module.
 * Used for SPA-like navigation via google.script.run.
 * Validates the module name against an explicit whitelist to prevent path traversal.
 *
 * @param moduleName - The name of the module to load (must match whitelist).
 * @returns The evaluated HTML content string.
 */
function getModuleContent(moduleName: string): string {
  if (!isAuthorized()) throw new Error("Unauthorized");

  // Sanitize: strip any path separators or extension attempts
  const sanitized = moduleName.replace(/[\/\\\.]/g, '');

  if (!ALLOWED_MODULES.has(sanitized)) {
    throw new Error(`Módulo no permitido: ${sanitized}`);
  }

  return HtmlService.createTemplateFromFile(`ui/modules/${sanitized}`)
    .evaluate()
    .getContent();
}
