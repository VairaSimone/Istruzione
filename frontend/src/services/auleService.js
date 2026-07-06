import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo AULE VIRTUALI.
 * Ogni funzione mappa 1:1 un endpoint di `backend/src/routes/auleRoutes.js`.
 *
 * Autorizzazione (replicata lato UI solo per UX, applicata comunque
 * server-side): tutte le route sono riservate a insegnante|admin; un
 * insegnante opera solo sulle proprie aule.
 */

/** GET /api/aule — elenco aule con filtri e paginazione. */
export const getAule = async (filters = {}) => {
  const params = {};
  if (filters.livello) params.livello = filters.livello;
  if (filters.anno) params.anno = filters.anno;
  if (filters.archiviata !== undefined && filters.archiviata !== '') {
    params.archiviata = filters.archiviata;
  }
  if (filters.q) params.q = filters.q;
  if (filters.scuola) params.scuola = filters.scuola;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/aule', { params });
  return { classi: data.data.classi, paginazione: data.paginazione ?? null };
};

/** GET /api/aule/:id — dettaglio con elenco insegnanti/studenti. */
export const getAulaById = async (id) => {
  const { data } = await apiClient.get(`/aule/${id}`);
  return data.data.classe;
};

/** POST /api/aule — crea aula. */
export const createAula = async (payload) => {
  const { data } = await apiClient.post('/aule', payload);
  return data.data.classe;
};

/** PATCH /api/aule/:id — modifica aula. */
export const updateAula = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/aule/${id}`, payload);
  return data.data.classe;
};

/** DELETE /api/aule/:id — elimina aula. */
export const deleteAula = async (id) => {
  const { data } = await apiClient.delete(`/aule/${id}`);
  return data;
};

/** POST /api/aule/:id/studenti — aggiunge uno studente già registrato. */
export const addStudent = async ({ id, utenteId, email }) => {
  const body = utenteId ? { utenteId } : { email };
  const { data } = await apiClient.post(`/aule/${id}/studenti`, body);
  return data.data.membro;
};

/** DELETE /api/aule/:id/studenti/:utenteId — rimuove uno studente. */
export const removeStudent = async ({ id, utenteId }) => {
  const { data } = await apiClient.delete(`/aule/${id}/studenti/${utenteId}`);
  return data;
};

/** POST /api/aule/:id/insegnanti — aggiunge un co-insegnante. */
export const addTeacher = async ({ id, utenteId, email }) => {
  const body = utenteId ? { utenteId } : { email };
  const { data } = await apiClient.post(`/aule/${id}/insegnanti`, body);
  return data.data.membro;
};

/** DELETE /api/aule/:id/insegnanti/:utenteId — rimuove un co-insegnante. */
export const removeTeacher = async ({ id, utenteId }) => {
  const { data } = await apiClient.delete(`/aule/${id}/insegnanti/${utenteId}`);
  return data;
};

/** POST /api/aule/:id/inviti — invita uno studente via email nell'aula. */
export const inviteStudent = async ({ id, email }) => {
  const { data } = await apiClient.post(`/aule/${id}/inviti`, { email });
  return data.data.invito;
};
