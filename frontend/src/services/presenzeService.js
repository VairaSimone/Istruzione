import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo REGISTRO PRESENZE.
 * Mappa 1:1 gli endpoint di `backend/src/routes/presenzeRoutes.js`.
 *
 * Due gruppi:
 *   - GESTIONE (insegnante|admin): appelli per aula, voci, riepilogo assenze;
 *   - VISTA STUDENTE: le proprie presenze e il conteggio rispetto al limite.
 */

// ── Vista studente ──

/** GET /api/presenze/mie — proprie presenze + riepilogo conteggio/limite. */
export const getMiePresenze = async (filters = {}) => {
  const params = {};
  if (filters.da) params.da = filters.da;
  if (filters.a) params.a = filters.a;

  const { data } = await apiClient.get('/presenze/mie', { params });
  return data.data; // { voci, riepilogo }
};

// ── Gestione appelli (insegnante/admin) ──

/** GET /api/presenze/registri — elenco appelli, con filtri e paginazione. */
export const getRegistri = async (filters = {}) => {
  const params = {};
  if (filters.classeId) params.classeId = filters.classeId;
  if (filters.da) params.da = filters.da;
  if (filters.a) params.a = filters.a;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/presenze/registri', { params });
  return { registri: data.data.registri, paginazione: data.paginazione ?? null };
};

/** GET /api/presenze/registri/:id — dettaglio appello con le voci. */
export const getRegistroById = async (id) => {
  const { data } = await apiClient.get(`/presenze/registri/${id}`);
  return data.data.registro;
};

/** POST /api/presenze/registri — apre un appello (roster precompilato). */
export const createRegistro = async (payload) => {
  const { data } = await apiClient.post('/presenze/registri', payload);
  return data.data.registro;
};

/** PATCH /api/presenze/registri/:id — modifica argomento/note. */
export const updateRegistro = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/presenze/registri/${id}`, payload);
  return data.data.registro;
};

/** DELETE /api/presenze/registri/:id — elimina appello. */
export const deleteRegistro = async (id) => {
  const { data } = await apiClient.delete(`/presenze/registri/${id}`);
  return data;
};

/** PUT /api/presenze/registri/:id/voci — salva (upsert) le presenze. */
export const saveVoci = async ({ id, voci }) => {
  const { data } = await apiClient.put(`/presenze/registri/${id}/voci`, { voci });
  return data.data.registro;
};

/** GET /api/presenze/riepilogo/:classeId — riepilogo assenze dell'aula. */
export const getRiepilogoAula = async (classeId) => {
  const { data } = await apiClient.get(`/presenze/riepilogo/${classeId}`);
  return data.data.riepilogo;
};
