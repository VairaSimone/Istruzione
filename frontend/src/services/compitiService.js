import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo COMPITI.
 * Mappa 1:1 gli endpoint di `backend/src/routes/compitiRoutes.js`.
 *
 * Due gruppi: azioni del DOCENTE (CRUD, assegnazioni, consegne, valutazione)
 * e vista dello STUDENTE (elenco per stato, dettaglio, consegna).
 */

// ── Docente ──

export const getCompiti = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/compiti', { params });
  return { compiti: data.data.compiti, paginazione: data.paginazione ?? null };
};

export const getCompitoById = async (id) => {
  const { data } = await apiClient.get(`/compiti/${id}`);
  return data.data.compito;
};

export const createCompito = async (payload) => {
  const { data } = await apiClient.post('/compiti', payload);
  return data.data.compito;
};

export const updateCompito = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/compiti/${id}`, payload);
  return data.data.compito;
};

export const deleteCompito = async (id) => {
  const { data } = await apiClient.delete(`/compiti/${id}`);
  return data;
};

export const addAssegnazione = async ({ id, classeId, utenteId }) => {
  const body = classeId ? { classeId } : { utenteId };
  const { data } = await apiClient.post(`/compiti/${id}/assegnazioni`, body);
  return data.data.assegnazione;
};

export const removeAssegnazione = async ({ id, assegnazioneId }) => {
  const { data } = await apiClient.delete(`/compiti/${id}/assegnazioni/${assegnazioneId}`);
  return data;
};

export const getConsegne = async (id) => {
  const { data } = await apiClient.get(`/compiti/${id}/consegne`);
  return data.data; // { compito, consegne }
};

export const valutaConsegna = async ({ id, utenteId, punteggioOttenuto, feedback }) => {
  const body = {};
  if (punteggioOttenuto !== undefined) body.punteggioOttenuto = punteggioOttenuto;
  if (feedback !== undefined) body.feedback = feedback;
  const { data } = await apiClient.patch(`/compiti/${id}/consegne/${utenteId}`, body);
  return data.data.consegna;
};

// ── Studente ──

export const getCompitiStudente = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/compiti/studente', { params });
  return { compiti: data.data.compiti, paginazione: data.paginazione ?? null };
};

export const getCompitoStudenteById = async (id) => {
  const { data } = await apiClient.get(`/compiti/studente/${id}`);
  return data.data.compito;
};

export const consegnaCompito = async ({ id, punteggioOttenuto, tempoImpiegatoSecondi }) => {
  const body = {};
  if (punteggioOttenuto !== undefined) body.punteggioOttenuto = punteggioOttenuto;
  if (tempoImpiegatoSecondi !== undefined) body.tempoImpiegatoSecondi = tempoImpiegatoSecondi;
  const { data } = await apiClient.post(`/compiti/studente/${id}/consegna`, body);
  return data.data.consegna;
};
