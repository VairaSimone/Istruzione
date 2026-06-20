import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo Auth.
 * Ogni funzione mappa 1:1 un endpoint reale presente in
 * `backend/src/routes/authRoutes.js`. Nessuna funzione qui sotto chiama
 * un endpoint non implementato nel backend.
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
 * NOTA: il backend si aspetta il campo `nuovaPassword`, non `password`,
 * nonostante la documentazione dichiari `password` — vedi
 * `validators/authValidators.js::validateResetPassword` e
 * `authController.resetPassword`, che leggono entrambi `nuovaPassword`.
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

/**
 * NOTA: GET /auth/confirm-email-change è pensato per essere aperto
 * direttamente dal link nell'email (il backend risponde con un redirect
 * 302 verso FRONTEND_URL/verify-email-change?status=success in caso di
 * successo). Il frontend NON deve chiamare questa funzione via fetch/XHR
 * in background: la pagina VerifyEmailChangePage si limita a leggere i
 * query param dopo che il browser ha già seguito il redirect del backend.
 * Questa funzione è esposta solo per completezza/test manuali, non è
 * collegata a nessun componente UI.
 */
export const confirmEmailChangeUrl = (token) =>
  `${import.meta.env.VITE_API_BASE_URL}/auth/confirm-email-change?token=${encodeURIComponent(token)}`;
