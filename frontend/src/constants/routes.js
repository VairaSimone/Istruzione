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
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  QUIZ: '/quiz',
  AULE: '/aule',
  AULA_DETAIL: '/aule/:id',
  COMPITI: '/compiti',
  COMPITO_DETAIL: '/compiti/:id',
  COMPITI_STUDENTE: '/i-miei-compiti',
  COMPITO_STUDENTE_DETAIL: '/i-miei-compiti/:id',
  TEACHER_DASHBOARD: '/statistiche',
  MESSAGGI: '/messaggi',
  MESSAGGIO_DETAIL: '/messaggi/:id',
  USERS_MANAGEMENT: '/gestione/utenti',
  INVITES_MANAGEMENT: '/gestione/inviti',
  ADMIN_TEACHER_REQUESTS: '/admin/candidature',
  NOT_FOUND: '/404',
  FORBIDDEN: '/403',
});

/** Costruttori di path con parametri (per <Link>/navigate). */
export const aulaDetailPath = (id) => `/aule/${id}`;
export const compitoDetailPath = (id) => `/compiti/${id}`;
export const compitoStudenteDetailPath = (id) => `/i-miei-compiti/${id}`;
export const messaggioDetailPath = (id) => `/messaggi/${id}`;
