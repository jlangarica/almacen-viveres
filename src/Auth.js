/**
 * @fileoverview Módulo de Seguridad y Autorización HCG.
 * @author Antigravity
 */
// Variables Globales de Configuración
const SS_ID = "1pvbHuJhIir5EvmTBk0bZrz2-1gotpLngqhrR1E1NYnQ";
const SHEET_NAME = "Usuarios";
const CACHE_KEY = "authorized_emails_list";
const AUTHORIZED_DOMAIN = "hcg.gob.mx";
/**
 * Verifica la autorización del usuario contra la base de datos centralizada.
 * Implementa un patrón de 3 capas: Dominio → Caché → Spreadsheet.
 *
 * @param email - El correo electrónico obtenido via Session.getActiveUser().getEmail().
 * @returns True si el usuario tiene acceso permitido.
 */
function isUserAuthorized(email) {
    if (!email)
        return false;
    const targetEmail = email.toLowerCase().trim();
    // Capa 1 (Dominio): Si el email no termina en @hcg.gob.mx, retorna false inmediatamente.
    if (!targetEmail.endsWith(`@${AUTHORIZED_DOMAIN}`)) {
        return false;
    }
    // Capa 2 (Caché): Intenta obtener la lista desde CacheService.getScriptCache().
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(CACHE_KEY);
    if (cachedData) {
        try {
            const allowedEmails = JSON.parse(cachedData);
            if (allowedEmails.includes(targetEmail)) {
                return true;
            }
        }
        catch (e) {
            console.warn("Error parseando caché, procediendo a recargar desde Spreadsheet.");
        }
    }
    // Capa 3 (Spreadsheet - Batching) — Sin LockService (operación de solo lectura).
    try {
        const ss = SpreadsheetApp.openById(SS_ID);
        const sheet = ss.getSheetByName(SHEET_NAME);
        if (!sheet) {
            throw new Error(`No se encontró la hoja con el nombre: ${SHEET_NAME}`);
        }
        const data = sheet.getDataRange().getValues();
        // Busca el índice de la columna 'email' (Columna 3, Índice 2)
        const emailIndex = 2;
        const emails = data.slice(1)
            .map(row => row[emailIndex] ? String(row[emailIndex]).toLowerCase().trim() : "")
            .filter(e => e !== "");
        // Guarda la lista en caché como string JSON por 1200 segundos (20 min).
        cache.put(CACHE_KEY, JSON.stringify(emails), 1200);
        return emails.includes(targetEmail);
    }
    catch (err) {
        // Manejo de Errores y Logs: Si el SS_ID no es accesible, dispara console.error con un objeto JSON
        console.error(JSON.stringify({
            status: "ERROR_ACCESSING_DATABASE",
            ssId: SS_ID,
            timestamp: new Date().toISOString(),
            details: String(err)
        }));
    }
    return false;
}
/**
 * Función puente para mantener compatibilidad con la interfaz actual.
 *
 * @returns True si el usuario de la sesión activa está autorizado.
 */
function isAuthorized() {
    return isUserAuthorized(Session.getActiveUser().getEmail());
}
/**
 * Gets the current user's email for the frontend.
 *
 * @returns The user's email address.
 */
function getUserEmail() {
    return Session.getActiveUser().getEmail();
}
