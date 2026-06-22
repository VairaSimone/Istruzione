/**
 * Costanti di dominio.
 * Rispecchiano ESATTAMENTE i valori validi definiti nel modello Sequelize
 * `Utente.js` (CLASSI_VALIDE, RUOLI_VALIDI, LINGUE_VALIDE) e nei validators
 * Express. Tenute centralizzate per evitare valori "magici" sparsi nei componenti.
 *
 * NOTA i18n: le etichette leggibili (ruoli, classi, lingue) NON sono più
 * definite qui ma risolte a runtime tramite le chiavi di traduzione
 * (`roles.*`, `classi.*`, `language.options.*`). Qui restano solo i VALORI
 * di dominio, che coincidono con quelli persistiti dal backend.
 */

export const ROLES = Object.freeze({
  STUDENTE: 'studente',
  INSEGNANTE: 'insegnante',
});

export const ROLE_OPTIONS = [ROLES.STUDENTE, ROLES.INSEGNANTE];

export const CLASSI = Object.freeze(['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta']);

export const LINGUE = Object.freeze({
  IT: 'it',
  EN: 'en',
});

/**
 * Codici di errore "machine-readable" restituiti dal backend
 * (vedi AppError, errorHandler.js, authService.js).
 * Usati per logica condizionale nel frontend (es. mostrare un countdown
 * sul lockout, o forzare un redirect su token scaduto) e per mappare il
 * messaggio localizzato in `getApiErrorMessage` (errors.codes.<CODE>).
 */
export const API_ERROR_CODES = Object.freeze({
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NO_REFRESH_TOKEN: 'NO_REFRESH_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  NOT_FOUND: 'NOT_FOUND',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  TOO_MANY_LOGIN_ATTEMPTS: 'TOO_MANY_LOGIN_ATTEMPTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  EMAIL_UNCHANGED: 'EMAIL_UNCHANGED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  EXPIRED_RESET_TOKEN: 'EXPIRED_RESET_TOKEN',
  EXPIRED_VERIFICATION_TOKEN: 'EXPIRED_VERIFICATION_TOKEN',
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_ROLE: 'INVALID_ROLE',
  LAST_TEACHER: 'LAST_TEACHER',
  SELF_ROLE_CHANGE_FORBIDDEN: 'SELF_ROLE_CHANGE_FORBIDDEN',
  SELF_DELETE_FORBIDDEN: 'SELF_DELETE_FORBIDDEN',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CORS_ORIGIN_FORBIDDEN: 'CORS_ORIGIN_FORBIDDEN',
});

/** Età minima/massima ammesse in registrazione (vedi modello Utente) */
export const ETA_MIN = 14;
export const ETA_MAX = 99;

/** Durata del cookie access_token lato server: usata solo per logica di UI (countdown, ecc.) */
export const ACCESS_TOKEN_TTL_MINUTES = 15;
