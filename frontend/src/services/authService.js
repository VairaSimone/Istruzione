import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo Auth.
 * Ogni funzione mappa 1:1 un endpoint reale presente in
 * `backend/src/routes/authRoutes.js`.
 */

// ── Endpoint pubblici ──────────────────────────────────────────────

export const register = async (payload) => {
  const { data } = await apiClient.post('/auth/register', payload);
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

/**
 * NOTA: il backend si aspetta il campo `nuovaPassword`, non `password`.
 */
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
 * richiesta POST esplicita. Non è una GET che modifica lo stato, quindi
 * non è soggetta a prefetch/scansione dei link.
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

export const requestEmailChange = async ({ nuovaEmail }) => {
  const { data } = await apiClient.post('/auth/request-email-change', {
    nuovaEmail,
  });
  return data;
};