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
  ADMIN: 'admin',
});

/**
 * Opzioni mostrate nel <select> di cambio ruolo della gestione utenti.
 * Volutamente NON include 'admin': l'assegnazione del ruolo admin è
 * un'operazione sensibile, riservata e non esposta tramite una dropdown
 * (il backend la blocca comunque per i non-admin). Gli utenti già admin
 * vengono mostrati come badge in sola lettura (vedi UserRow).
 */
export const ROLE_OPTIONS = [ROLES.STUDENTE, ROLES.INSEGNANTE];

/**
 * Stato del ciclo di vita dell'account (rispecchia il campo `stato` del
 * modello Sequelize `Utente`). Un utente loggato è sempre 'attivo' (il
 * backend nega il login agli altri stati): questi valori servono per la
 * gestione lato insegnante/admin (lista utenti, candidature).
 */
export const ACCOUNT_STATES = Object.freeze({
  ATTIVO: 'attivo',
  IN_ATTESA: 'in_attesa',
  RIFIUTATO: 'rifiutato',
});

/** Stato del ciclo di vita di un invito (modello `Invito`). */
export const INVITE_STATES = Object.freeze({
  PENDENTE: 'pendente',
  COMPLETATO: 'completato',
  REVOCATO: 'revocato',
});

/** Ruoli che un invito può conferire. */
export const INVITE_ROLES = Object.freeze({
  STUDENTE: 'studente',
  INSEGNANTE: 'insegnante',
});

export const CLASSI = Object.freeze(['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta']);

/**
 * Livelli JLPT usati dalle aule virtuali (modello `Classe.LIVELLI_JLPT`) e dai
 * compiti. Ordinati dal più elementare (N5) al più avanzato (N1).
 */
export const LIVELLI_JLPT = Object.freeze(['N5', 'N4', 'N3', 'N2', 'N1']);

/** Tipi di attività assegnabili in un compito (modello `Compito.TIPI_ATTIVITA`). */
export const TIPI_ATTIVITA_COMPITO = Object.freeze([
  'quiz_kana',
  'quiz_kanji',
  'tracciamento',
  'vocabolario',
]);

/** Stato di pubblicazione del compito (modello `Compito.STATI_COMPITO`). */
export const STATI_COMPITO = Object.freeze(['bozza', 'pubblicato', 'archiviato']);

/** Stato del compito PER STUDENTE (derivato lato backend). */
export const STATI_COMPITO_STUDENTE = Object.freeze([
  'assegnato',
  'in_scadenza',
  'scaduto',
  'completato',
]);

/** Alfabeti kana (per la configurazione dei quiz kana). */
export const ALFABETI_KANA = Object.freeze(['hiragana', 'katakana']);

/** Tipi di messaggio (modello `Messaggio.TIPI_MESSAGGIO`). */
export const TIPI_MESSAGGIO = Object.freeze([
  'messaggio',
  'incoraggiamento',
  'feedback',
  'nota_privata',
]);

/** Tipi selezionabili in composizione (il feedback si crea dai compiti). */
export const TIPI_MESSAGGIO_COMPONIBILI = Object.freeze([
  'messaggio',
  'incoraggiamento',
  'nota_privata',
]);

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
  // Google OAuth / account
  GOOGLE_OAUTH_DISABLED: 'GOOGLE_OAUTH_DISABLED',
  USE_GOOGLE_LOGIN: 'USE_GOOGLE_LOGIN',
  GOOGLE_NO_EMAIL: 'GOOGLE_NO_EMAIL',
  GOOGLE_NO_ACCOUNT: 'GOOGLE_NO_ACCOUNT',
  INVALID_LANGUAGE: 'INVALID_LANGUAGE',
  // Stato account (login negato per insegnanti non attivi)
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
  ACCOUNT_NOT_ACTIVE: 'ACCOUNT_NOT_ACTIVE',
  // Sistema inviti
  INVALID_INVITE: 'INVALID_INVITE',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_ALREADY_USED: 'INVITE_ALREADY_USED',
  INVITE_ROLE_MISMATCH: 'INVITE_ROLE_MISMATCH',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_NOT_PENDING: 'INVITE_NOT_PENDING',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CLASS: 'INVALID_CLASS',
  // Approvazione insegnanti / ruoli admin
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  ALREADY_ACTIVE: 'ALREADY_ACTIVE',
  ADMIN_ROLE_FORBIDDEN: 'ADMIN_ROLE_FORBIDDEN',
  LAST_ADMIN: 'LAST_ADMIN',
});

/** Età minima/massima ammesse in registrazione (vedi modello Utente) */
export const ETA_MIN = 14;
export const ETA_MAX = 99;

/** Durata del cookie access_token lato server: usata solo per logica di UI (countdown, ecc.) */
export const ACCESS_TOKEN_TTL_MINUTES = 15;
