/**
 * Costanti di dominio.
 * Rispecchiano ESATTAMENTE i valori validi definiti nei modelli Sequelize e nei
 * validator Express. Tenute centralizzate per evitare valori "magici" sparsi
 * nei componenti.
 *
 * NOTA i18n: le etichette leggibili (ruoli, lingue) NON sono definite qui ma
 * risolte a runtime tramite le chiavi di traduzione (`roles.*`,
 * `language.options.*`). Qui restano solo i VALORI di dominio, che coincidono
 * con quelli persistiti dal backend.
 *
 * NOTA GENERALIZZAZIONE: classi, livelli e materie NON sono più elencati qui.
 * Erano ENUM legati all'insegnamento del giapponese (`Prima…Quinta`, `N5…N1`) e
 * sono diventati VOCABOLARI DELLA SCUOLA, letti a runtime dalle impostazioni
 * (`hooks/useImpostazioniScuola.js`). Qui restano solo i limiti di lunghezza,
 * che sono un vincolo di colonna e non di dominio. Analogamente i tipi di
 * attività dei compiti vivono ora in `constants/tipiAttivita.js`.
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

/**
 * Limiti di LUNGHEZZA dei campi a testo libero, allineati alle colonne del
 * backend. Non sono vocabolari: il contenuto ammesso lo decide ogni scuola.
 *   - `classe`  → `Utente.CLASSE_MAX`  (es. "Prima", "A1", "Gruppo serale")
 *   - `livello` → `Classe.LIVELLO_MAX` / `Corso.LIVELLO_MAX`
 *   - `materia` → `Corso.MATERIA_MAX`  (es. "Matematica", "Inglese")
 */
export const CLASSE_MAX = 60;
export const LIVELLO_MAX = 40;
export const MATERIA_MAX = 80;

/** Stato di pubblicazione del compito (modello `Compito.STATI_COMPITO`). */
export const STATI_COMPITO = Object.freeze(['bozza', 'pubblicato', 'archiviato']);

/**
 * Stato di pubblicazione del corso di videolezioni (modello `Corso.STATI_CORSO`).
 *   - 'bozza'      → visibile solo allo staff della scuola;
 *   - 'pubblicato' → guardabile dagli studenti delle aule a cui è reso disponibile;
 *   - 'archiviato' → concluso/nascosto, resta nello storico.
 */
export const STATI_CORSO = Object.freeze(['bozza', 'pubblicato', 'archiviato']);

/** Stato del compito PER STUDENTE (derivato lato backend). */
export const STATI_COMPITO_STUDENTE = Object.freeze([
  'assegnato',
  'in_scadenza',
  'scaduto',
  'completato',
]);

/**
 * Alfabeti kana. Appartengono al TEMPLATE di giapponese, non al nucleo della
 * piattaforma: li usano solo i componenti del quiz kana e della pratica di
 * scrittura, visibili unicamente alle scuole che hanno installato quel template.
 */
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
  // Multi-tenant (scuole)
  CROSS_SCUOLA_FORBIDDEN: 'CROSS_SCUOLA_FORBIDDEN',
  SCUOLA_REQUIRED: 'SCUOLA_REQUIRED',
  SCUOLA_NOT_FOUND: 'SCUOLA_NOT_FOUND',
  SCUOLA_NAME_TAKEN: 'SCUOLA_NAME_TAKEN',
  SCUOLA_HAS_USERS: 'SCUOLA_HAS_USERS',
  NO_SCUOLA: 'NO_SCUOLA',
  INVALID_SETTINGS: 'INVALID_SETTINGS',
  // Sezioni disattivabili per scuola (middleware `richiediFunzionalita`)
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  SCUOLA_SOSPESA: 'SCUOLA_SOSPESA',
  SLUG_REQUIRED: 'SLUG_REQUIRED',
  SLUG_CONFLICT: 'SLUG_CONFLICT',
  INVALID_ACTIVITY_TYPE: 'INVALID_ACTIVITY_TYPE',
  VALORE_FUORI_VOCABOLARIO: 'VALORE_FUORI_VOCABOLARIO',
  // Videolezioni on-demand (corsi)
  CORSO_NOT_FOUND: 'CORSO_NOT_FOUND',
  CAPITOLO_NOT_FOUND: 'CAPITOLO_NOT_FOUND',
  DOCUMENTO_NOT_FOUND: 'DOCUMENTO_NOT_FOUND',
  ALREADY_AVAILABLE: 'ALREADY_AVAILABLE',
  AVAILABILITY_NOT_FOUND: 'AVAILABILITY_NOT_FOUND',
  TOO_MANY_CAPITOLI: 'TOO_MANY_CAPITOLI',
  // Quiz delle scuole (template installabili + quiz personalizzati)
  QUIZ_NOT_FOUND: 'QUIZ_NOT_FOUND',
  DOMANDA_NOT_FOUND: 'DOMANDA_NOT_FOUND',
  CLASSE_NOT_FOUND: 'CLASSE_NOT_FOUND',
  ENABLEMENT_NOT_FOUND: 'ENABLEMENT_NOT_FOUND',
  ALREADY_ENABLED: 'ALREADY_ENABLED',
  QUIZ_TEMPLATE_NON_ABILITATO: 'QUIZ_TEMPLATE_NON_ABILITATO',
  INVALID_QUIZ_TEMPLATE: 'INVALID_QUIZ_TEMPLATE',
  INVALID_QUIZ_CONFIG: 'INVALID_QUIZ_CONFIG',
  QUIZ_TEMPLATE_IMMUTABILE: 'QUIZ_TEMPLATE_IMMUTABILE',
  QUIZ_CONFIG_NON_AMMESSA: 'QUIZ_CONFIG_NON_AMMESSA',
  QUIZ_TEMPLATE_NO_DOMANDE: 'QUIZ_TEMPLATE_NO_DOMANDE',
  TROPPE_DOMANDE: 'TROPPE_DOMANDE',
  DOMANDA_OPZIONI_NON_AMMESSE: 'DOMANDA_OPZIONI_NON_AMMESSE',
  DOMANDA_RISPOSTA_MANCANTE: 'DOMANDA_RISPOSTA_MANCANTE',
  DOMANDA_TROPPE_ALTERNATIVE: 'DOMANDA_TROPPE_ALTERNATIVE',
  DOMANDA_VERO_FALSO_INCOMPLETA: 'DOMANDA_VERO_FALSO_INCOMPLETA',
  DOMANDA_OPZIONI_MANCANTI: 'DOMANDA_OPZIONI_MANCANTI',
  DOMANDA_NUMERO_OPZIONI: 'DOMANDA_NUMERO_OPZIONI',
  DOMANDA_UNICA_CORRETTA: 'DOMANDA_UNICA_CORRETTA',
  EMPTY_QUIZ_POOL: 'EMPTY_QUIZ_POOL',
  INVALID_SUBMISSION: 'INVALID_SUBMISSION',
});

/** Età minima/massima ammesse in registrazione (vedi modello Utente) */
export const ETA_MIN = 14;
export const ETA_MAX = 99;

/** Durata del cookie access_token lato server: usata solo per logica di UI (countdown, ecc.) */
export const ACCESS_TOKEN_TTL_MINUTES = 15;
