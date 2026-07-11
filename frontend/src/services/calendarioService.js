import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo CALENDARIO.
 * Mappa 1:1 gli endpoint di `backend/src/routes/calendarioRoutes.js`.
 *
 * Due gruppi:
 *   - FEED (studenti + insegnanti): la vista unificata del calendario, che
 *     unisce gli eventi persistiti alle scadenze dei compiti;
 *   - GESTIONE EVENTI (insegnante|admin): CRUD e destinatari.
 */

// ── Feed (tutti i ruoli) ──

/** GET /api/calendario — feed unificato nella finestra [da, a]. */
export const getFeed = async (filters = {}) => {
  const params = {};
  if (filters.da) params.da = filters.da;
  if (filters.a) params.a = filters.a;
  if (filters.tipoVoce) params.tipoVoce = filters.tipoVoce;

  const { data } = await apiClient.get('/calendario', { params });
  return data.data; // { voci, finestra }
};

// ── Gestione eventi (insegnante/admin) ──

/** GET /api/calendario/eventi — elenco eventi creati, con filtri e paginazione. */
export const getEventi = async (filters = {}) => {
  const params = {};
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.q) params.q = filters.q;
  if (filters.da) params.da = filters.da;
  if (filters.a) params.a = filters.a;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/calendario/eventi', { params });
  return { eventi: data.data.eventi, paginazione: data.paginazione ?? null };
};

/** GET /api/calendario/eventi/:id — dettaglio con destinatari espansi. */
export const getEventoById = async (id) => {
  const { data } = await apiClient.get(`/calendario/eventi/${id}`);
  return data.data.evento;
};

/** POST /api/calendario/eventi — crea evento (con destinatari inline). */
export const createEvento = async (payload) => {
  const { data } = await apiClient.post('/calendario/eventi', payload);
  return data.data.evento;
};

/** PATCH /api/calendario/eventi/:id — modifica evento. */
export const updateEvento = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/calendario/eventi/${id}`, payload);
  return data.data.evento;
};

/** DELETE /api/calendario/eventi/:id — elimina evento. */
export const deleteEvento = async (id) => {
  const { data } = await apiClient.delete(`/calendario/eventi/${id}`);
  return data;
};

/** POST /api/calendario/eventi/:id/destinatari — destina a classe|studente. */
export const addDestinatario = async ({ id, classeId, utenteId }) => {
  const body = classeId ? { classeId } : { utenteId };
  const { data } = await apiClient.post(`/calendario/eventi/${id}/destinatari`, body);
  return data.data.destinatario;
};

/** DELETE /api/calendario/eventi/:id/destinatari/:destinatarioId — rimuove destinatario. */
export const removeDestinatario = async ({ id, destinatarioId }) => {
  const { data } = await apiClient.delete(
    `/calendario/eventi/${id}/destinatari/${destinatarioId}`
  );
  return data;
};
