import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo CORSI (videolezioni on-demand).
 * Mappa 1:1 gli endpoint di `backend/src/routes/corsiRoutes.js`.
 *
 * Due gruppi: azioni dello STAFF (insegnante/admin) — CRUD corsi, capitoli,
 * documenti allegati e gestione della disponibilità presso le aule — e vista
 * dello STUDENTE (catalogo dei corsi disponibili e player con policy di
 * download effettiva).
 */

// ── Staff (insegnante | admin) ──

/** GET /api/corsi — elenco corsi della propria scuola, con filtri/paginazione. */
export const getCorsi = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.livello) params.livello = filters.livello;
  if (filters.q) params.q = filters.q;
  if (filters.scuola) params.scuola = filters.scuola;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/corsi', { params });
  return { corsi: data.data.corsi, paginazione: data.paginazione ?? null };
};

/** GET /api/corsi/:id — dettaglio con capitoli, documenti e aule disponibili. */
export const getCorsoById = async (id) => {
  const { data } = await apiClient.get(`/corsi/${id}`);
  return data.data.corso;
};

/** POST /api/corsi — crea corso (capitoli inline facoltativi). */
export const createCorso = async (payload) => {
  const { data } = await apiClient.post('/corsi', payload);
  return data.data.corso;
};

/** PATCH /api/corsi/:id — aggiorna i metadati del corso. */
export const updateCorso = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/corsi/${id}`, payload);
  return data.data.corso;
};

/** DELETE /api/corsi/:id — elimina il corso (cascade su capitoli/documenti). */
export const deleteCorso = async (id) => {
  const { data } = await apiClient.delete(`/corsi/${id}`);
  return data;
};

// ── Capitoli ──

/** POST /api/corsi/:id/capitoli — aggiunge un capitolo al corso. */
export const addCapitolo = async ({ id, ...payload }) => {
  const { data } = await apiClient.post(`/corsi/${id}/capitoli`, payload);
  return data.data.capitolo;
};

/** PATCH /api/corsi/:id/capitoli/:capitoloId — aggiorna un capitolo. */
export const updateCapitolo = async ({ id, capitoloId, ...payload }) => {
  const { data } = await apiClient.patch(`/corsi/${id}/capitoli/${capitoloId}`, payload);
  return data.data.capitolo;
};

/** DELETE /api/corsi/:id/capitoli/:capitoloId — elimina un capitolo. */
export const deleteCapitolo = async ({ id, capitoloId }) => {
  const { data } = await apiClient.delete(`/corsi/${id}/capitoli/${capitoloId}`);
  return data;
};

// ── Documenti allegati al capitolo ──

/** POST /api/corsi/:id/capitoli/:capitoloId/documenti — aggiunge un documento. */
export const addDocumento = async ({ id, capitoloId, ...payload }) => {
  const { data } = await apiClient.post(
    `/corsi/${id}/capitoli/${capitoloId}/documenti`,
    payload
  );
  return data.data.documento;
};

/** DELETE /api/corsi/:id/capitoli/:capitoloId/documenti/:documentoId. */
export const deleteDocumento = async ({ id, capitoloId, documentoId }) => {
  const { data } = await apiClient.delete(
    `/corsi/${id}/capitoli/${capitoloId}/documenti/${documentoId}`
  );
  return data;
};

// ── Disponibilità presso le aule ──

/** POST /api/corsi/:id/disponibilita — rende il corso disponibile a un'aula. */
export const rendiDisponibile = async ({ id, classeId }) => {
  const { data } = await apiClient.post(`/corsi/${id}/disponibilita`, { classeId });
  return data.data.aula;
};

/** DELETE /api/corsi/:id/disponibilita/:classeId — revoca la disponibilità. */
export const revocaDisponibilita = async ({ id, classeId }) => {
  const { data } = await apiClient.delete(`/corsi/${id}/disponibilita/${classeId}`);
  return data;
};

// ── Studente ──

/** GET /api/corsi/studente — catalogo dei corsi disponibili allo studente. */
export const getCorsiStudente = async (filters = {}) => {
  const params = {};
  if (filters.livello) params.livello = filters.livello;
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/corsi/studente', { params });
  return { corsi: data.data.corsi, paginazione: data.paginazione ?? null };
};

/** GET /api/corsi/studente/:id — dettaglio corso per lo studente (player). */
export const getCorsoStudenteById = async (id) => {
  const { data } = await apiClient.get(`/corsi/studente/${id}`);
  return data.data.corso;
};
