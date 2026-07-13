/**
 * Path delle route applicative. Centralizzati per evitare stringhe
 * "magiche" sparse tra <Link>, navigate() e definizioni delle <Route>.
 */
export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  VERIFY_EMAIL_CHANGE: '/verify-email-change',
  // Pagine legali pubbliche (accessibili senza autenticazione).
  PRIVACY: '/privacy',
  COOKIE: '/cookie',
  TERMINI: '/termini',
  ACCESSIBILITA: '/accessibilita',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  QUIZ: '/quiz',
  QUIZ_GESTIONE: '/gestione/quiz',
  QUIZ_GESTIONE_DETAIL: '/gestione/quiz/:id',
  AULE: '/aule',
  AULA_DETAIL: '/aule/:id',
  COMPITI: '/compiti',
  COMPITO_DETAIL: '/compiti/:id',
  COMPITI_STUDENTE: '/i-miei-compiti',
  COMPITO_STUDENTE_DETAIL: '/i-miei-compiti/:id',
  CORSI: '/corsi',
  CORSO_DETAIL: '/corsi/:id',
  CORSI_STUDENTE: '/i-miei-corsi',
  CORSO_STUDENTE_DETAIL: '/i-miei-corsi/:id',
  TEACHER_DASHBOARD: '/statistiche',
  MESSAGGI: '/messaggi',
  MESSAGGIO_DETAIL: '/messaggi/:id',
  CALENDARIO: '/calendario',
  CERTIFICATI: '/certificati',
  CERTIFICATI_STUDENTE: '/i-miei-certificati',
  VERIFICA_CERTIFICATO: '/verifica-certificato',
  VERIFICA_CERTIFICATO_CODICE: '/verifica-certificato/:codice',
  USERS_MANAGEMENT: '/gestione/utenti',
  INVITES_MANAGEMENT: '/gestione/inviti',
  CONTATTI_MANAGEMENT: '/gestione/contatti',
  SCUOLE_MANAGEMENT: '/gestione/scuole',
  IMPOSTAZIONI_SCUOLA: '/gestione/impostazioni',
  NOT_FOUND: '/404',
  FORBIDDEN: '/403',
});

/** Costruttori di path con parametri (per <Link>/navigate). */
export const aulaDetailPath = (id) => `/aule/${id}`;
export const compitoDetailPath = (id) => `/compiti/${id}`;
export const compitoStudenteDetailPath = (id) => `/i-miei-compiti/${id}`;
export const corsoDetailPath = (id) => `/corsi/${id}`;
export const corsoStudenteDetailPath = (id) => `/i-miei-corsi/${id}`;
export const messaggioDetailPath = (id) => `/messaggi/${id}`;
export const quizGestioneDetailPath = (id) => `/gestione/quiz/${id}`;

/** Path della pagina di verifica pubblica precompilata con un codice. */
export const verificaCertificatoPath = (codice) =>
  `/verifica-certificato/${encodeURIComponent(codice)}`;
