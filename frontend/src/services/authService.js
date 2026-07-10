import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo Auth.
 * Ogni funzione mappa 1:1 un endpoint reale presente in
 * `backend/src/routes/authRoutes.js`.
 */

// ── Endpoint pubblici ──────────────────────────────────────────────

/**
 * Completa la registrazione di uno STUDENTE a partire da un token di invito.
 * Email e classe sono ereditate dall'invito lato backend: qui si inviano solo
 * i dati anagrafici e la password. L'account nasce già attivo e verificato.
 */
export const registerStudent = async (payload) => {
  const { data } = await apiClient.post('/auth/register-student', payload);
  return data;
};

/**
 * Completa la registrazione di un INSEGNANTE a partire da un token di invito
 * creato da un admin (onboarding diretto). Nessuna classe.
 */
export const registerTeacher = async (payload) => {
  const { data } = await apiClient.post('/auth/register-teacher', payload);
  return data;
};

/**
 * Richiede il re-invio dell'email di verifica per un account registrato
 * ma non ancora verificato. Il backend risponde sempre con 200 e messaggio
 * generico (anti user-enumeration).
 */
export const resendVerification = async ({ email }) => {
  const { data } = await apiClient.post('/auth/resend-verification', { email });
  return data;
};

export const login = async ({ email, password }) => {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
};

export const refreshToken = async () => {
  const { data } = await apiClient.post('/auth/refresh-token');
  return data;
};

export const forgotPassword = async ({ email }) => {
  const { data } = await apiClient.post('/auth/forgot-password', { email });
  return data;
};

export const resetPassword = async ({ token, nuovaPassword }) => {
  const { data } = await apiClient.post('/auth/reset-password', {
    token,
    nuovaPassword,
  });
  return data;
};

export const verifyEmail = async ({ token }) => {
  const { data } = await apiClient.post('/auth/verify-email', { token });
  return data;
};

/**
 * Conferma il cambio email. Il link nell'email punta alla pagina
 * applicativa (/verify-email-change?token=...), che effettua questa
 * richiesta POST esplicita.
 */
export const confirmEmailChange = async ({ token }) => {
  const { data } = await apiClient.post('/auth/confirm-email-change', { token });
  return data;
};

// ── Endpoint protetti (richiedono sessione attiva) ─────────────────

export const getMe = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data;
};

export const logout = async () => {
  const { data } = await apiClient.post('/auth/logout');
  return data;
};

export const deleteMe = async () => {
  const { data } = await apiClient.delete('/auth/me');
  return data;
};

export const updateLanguage = async ({ lingua }) => {
  const { data } = await apiClient.patch('/auth/me/lingua', { lingua });
  return data;
};

/**
 * Legge le preferenze di notifica email dell'utente loggato
 * (GET /auth/me/notifiche). Il backend restituisce sempre il blob COMPLETO,
 * con i default già applicati:
 *   { emailAttive: boolean, categorie: { messaggi, compiti, scadenze, feedback } }
 */
export const getNotificationPreferences = async () => {
  const { data } = await apiClient.get('/auth/me/notifiche');
  return data;
};

/**
 * Aggiorna le preferenze di notifica email (PATCH /auth/me/notifiche):
 * interruttore generale + toggle per categoria. Il backend normalizza il blob
 * contro il registro dei tipi e restituisce la versione salvata.
 */
export const updateNotificationPreferences = async ({ emailAttive, categorie }) => {
  const { data } = await apiClient.patch('/auth/me/notifiche', {
    emailAttive,
    categorie,
  });
  return data;
};

export const requestEmailChange = async ({ nuovaEmail }) => {
  const { data } = await apiClient.post('/auth/request-email-change', {
    nuovaEmail,
  });
  return data;
};
