import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo SCUOLE (multi-tenant).
 * Ogni funzione mappa 1:1 un endpoint di `backend/src/routes/scuolaRoutes.js`.
 *
 * Autorizzazione (applicata server-side; replicata lato UI solo per UX):
 *   - lettura della PROPRIA scuola (`/mia`) → insegnante o admin;
 *   - tutte le altre operazioni → solo admin.
 */

/** GET /api/scuole — elenco scuole con conteggi (solo admin). */
export const getScuole = async (filters = {}) => {
  const params = {};
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/scuole', { params });
  return { scuole: data.data.scuole, paginazione: data.paginazione ?? null };
};

/**
 * GET /api/scuole/mia — scuola del richiedente (insegnante/admin).
 * Per l'admin il backend restituisce `null` (nessuna scuola: è trasversale).
 */
export const getMiaScuola = async () => {
  const { data } = await apiClient.get('/scuole/mia');
  return data.data.scuola;
};

/** GET /api/scuole/:id — dettaglio scuola (solo admin). */
export const getScuola = async (id) => {
  const { data } = await apiClient.get(`/scuole/${id}`);
  return data.data.scuola;
};

/** POST /api/scuole — { nome, impostazioni? } (solo admin). */
export const createScuola = async ({ nome, impostazioni }) => {
  const body = { nome, ...(impostazioni !== undefined ? { impostazioni } : {}) };
  const { data } = await apiClient.post('/scuole', body);
  return data.data.scuola;
};

/** PATCH /api/scuole/:id — { nome?, impostazioni? } (solo admin). */
export const updateScuola = async ({ id, nome, impostazioni }) => {
  const body = {};
  if (nome !== undefined) body.nome = nome;
  if (impostazioni !== undefined) body.impostazioni = impostazioni;
  const { data } = await apiClient.patch(`/scuole/${id}`, body);
  return data.data.scuola;
};

/**
 * PATCH /api/scuole/:id/impostazioni — merge delle chiavi fornite (solo admin).
 * `impostazioni` è un oggetto JSON: solo le chiavi presenti vengono aggiornate.
 */
export const updateImpostazioni = async ({ id, impostazioni }) => {
  const { data } = await apiClient.patch(`/scuole/${id}/impostazioni`, { impostazioni });
  return data.data.scuola;
};

/** DELETE /api/scuole/:id — elimina scuola (solo admin, bloccata se ha utenti). */
export const deleteScuola = async (id) => {
  const { data } = await apiClient.delete(`/scuole/${id}`);
  return data;
};
