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
  USERS_MANAGEMENT: '/gestione/utenti',
  NOT_FOUND: '/404',
  FORBIDDEN: '/403',
});
