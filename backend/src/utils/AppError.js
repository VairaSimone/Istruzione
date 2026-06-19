'use strict';

/**
 * Classe custom per gli errori operazionali dell'applicazione.
 * "Operazionale" = errore previsto (es. email già in uso, token scaduto).
 * Distinto dagli errori di programmazione (bug), che non devono mai
 * essere esposti al client.
 */
class AppError extends Error {
  /**
   * @param {string} message  - Messaggio leggibile dall'utente
   * @param {number} statusCode - Codice HTTP (400, 401, 403, 404, 409, 500...)
   * @param {string} [code]   - Codice errore machine-readable opzionale
   */
  constructor(message, statusCode, code = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;

    // Flag che distingue errori operazionali da bug
    this.isOperational = true;

    // Mantiene lo stack trace pulito (esclude il costruttore stesso)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
