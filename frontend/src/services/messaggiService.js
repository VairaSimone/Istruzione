import apiClient from '../api/axiosClient';

/**
 * Service layer per la MESSAGGISTICA.
 * Mappa 1:1 gli endpoint di `backend/src/routes/messaggiRoutes.js`.
 */

const paginated = (filters = {}) => {
  const params = {};
  if (filters.nonLetti !== undefined && filters.nonLetti !== '') params.nonLetti = filters.nonLetti;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  return params;
};

// ── Docente ──

export const inviaMessaggio = async (payload) => {
  const { data } = await apiClient.post('/messaggi', payload);
  return data.data.messaggio;
};

export const inviaFeedbackCompito = async (payload) => {
  const { data } = await apiClient.post('/messaggi/feedback-compito', payload);
  return data.data;
};

export const getInviati = async (filters = {}) => {
  const { data } = await apiClient.get('/messaggi/inviati', { params: paginated(filters) });
  return { messaggi: data.data.messaggi, paginazione: data.paginazione ?? null };
};

export const getNote = async (filters = {}) => {
  const { data } = await apiClient.get('/messaggi/note', { params: paginated(filters) });
  return { note: data.data.note, paginazione: data.paginazione ?? null };
};

// ── Condivise (docente + studente) ──

export const getRicevuti = async (filters = {}) => {
  const { data } = await apiClient.get('/messaggi/ricevuti', { params: paginated(filters) });
  return { messaggi: data.data.messaggi, paginazione: data.paginazione ?? null };
};

export const getNotifiche = async () => {
  const { data } = await apiClient.get('/messaggi/notifiche');
  return data.data; // { nonLetti }
};

export const getMessaggio = async (id) => {
  const { data } = await apiClient.get(`/messaggi/${id}`);
  return data.data.messaggio;
};

export const segnaLetto = async (id) => {
  const { data } = await apiClient.post(`/messaggi/${id}/letto`);
  return data.data.destinatario;
};

export const rispondi = async ({ id, corpo }) => {
  const { data } = await apiClient.post(`/messaggi/${id}/rispondi`, { corpo });
  return data.data.messaggio;
};

export const eliminaMessaggio = async (id) => {
  const { data } = await apiClient.delete(`/messaggi/${id}`);
  return data;
};
