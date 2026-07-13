import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo SCUOLE (multi-tenant).
 * Ogni funzione mappa 1:1 un endpoint di `backend/src/routes/scuolaRoutes.js`.
 *
 * Autorizzazione (applicata server-side; replicata lato UI solo per UX):
 *   - lettura/scrittura delle impostazioni della PROPRIA scuola (`/mia/...`) →
 *     insegnante o admin;
 *   - tutte le altre operazioni → solo admin.
 *
 * Le impostazioni non sono più un blob JSON libero: seguono lo SCHEMA
 * dichiarativo del backend (identita, aspetto, contatti, indirizzo, social,
 * footer, didattica, funzionalita). La PATCH è un merge PER SEZIONE: le chiavi
 * non citate restano invariate; un campo valorizzato a `null` viene azzerato.
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

/**
 * GET /api/scuole/mia/impostazioni — impostazioni COMPLETE della propria scuola
 * (default applicati), comprese le sezioni private come `didattica`, che il
 * pannello pubblico `/api/config` non espone.
 */
export const getMieImpostazioni = async () => {
  const { data } = await apiClient.get('/scuole/mia/impostazioni');
  return data.data.impostazioni;
};

/**
 * PATCH /api/scuole/mia/impostazioni — aggiorna le impostazioni della propria
 * scuola. Merge per sezione: si inviano solo le sezioni toccate.
 */
export const updateMieImpostazioni = async (impostazioni) => {
  const { data } = await apiClient.patch('/scuole/mia/impostazioni', { impostazioni });
  return data.data.impostazioni ?? data.data.scuola?.impostazioni;
};

/** GET /api/scuole/:id — dettaglio scuola (solo admin). */
export const getScuola = async (id) => {
  const { data } = await apiClient.get(`/scuole/${id}`);
  return data.data.scuola;
};

/** POST /api/scuole — { nome, slug?, attiva?, predefinita?, impostazioni?, limiti…, dominio? } (admin). */
export const createScuola = async ({
  nome,
  slug,
  attiva,
  predefinita,
  impostazioni,
  limiteStorageGb,
  limiteUtenti,
  limiteInsegnanti,
  dominio,
}) => {
  const body = { nome };
  if (slug) body.slug = slug;
  if (attiva !== undefined) body.attiva = attiva;
  if (predefinita !== undefined) body.predefinita = predefinita;
  if (impostazioni !== undefined) body.impostazioni = impostazioni;
  // Limiti quota: si inviano sempre (anche `null` = illimitato) così l'azzeramento
  // è esplicito. Il backend interpreta null/'' come "nessun limite".
  if (limiteStorageGb !== undefined) body.limiteStorageGb = limiteStorageGb;
  if (limiteUtenti !== undefined) body.limiteUtenti = limiteUtenti;
  if (limiteInsegnanti !== undefined) body.limiteInsegnanti = limiteInsegnanti;
  if (dominio) body.dominio = dominio;

  const { data } = await apiClient.post('/scuole', body);
  return data.data.scuola;
};

/** PATCH /api/scuole/:id — { nome?, slug?, attiva?, predefinita?, impostazioni?, limiti… } (admin). */
export const updateScuola = async ({
  id,
  nome,
  slug,
  attiva,
  predefinita,
  impostazioni,
  limiteStorageGb,
  limiteUtenti,
  limiteInsegnanti,
}) => {
  const body = {};
  if (nome !== undefined) body.nome = nome;
  if (slug !== undefined) body.slug = slug;
  if (attiva !== undefined) body.attiva = attiva;
  if (predefinita !== undefined) body.predefinita = predefinita;
  if (impostazioni !== undefined) body.impostazioni = impostazioni;
  if (limiteStorageGb !== undefined) body.limiteStorageGb = limiteStorageGb;
  if (limiteUtenti !== undefined) body.limiteUtenti = limiteUtenti;
  if (limiteInsegnanti !== undefined) body.limiteInsegnanti = limiteInsegnanti;

  const { data } = await apiClient.patch(`/scuole/${id}`, body);
  return data.data.scuola;
};

/** GET /api/scuole/mia/quota — occupazione quota della propria scuola (insegnante/admin). */
export const getMiaQuota = async () => {
  const { data } = await apiClient.get('/scuole/mia/quota');
  return data.data.quota;
};

/** GET /api/scuole/:id/quota — occupazione quota di una scuola (admin). */
export const getQuotaScuola = async (id) => {
  const { data } = await apiClient.get(`/scuole/${id}/quota`);
  return data.data.quota;
};

/**
 * PATCH /api/scuole/:id/impostazioni — merge per sezione (solo admin).
 * Usato dall'admin per configurare una scuola diversa dalla propria.
 */
export const updateImpostazioni = async ({ id, impostazioni }) => {
  const { data } = await apiClient.patch(`/scuole/${id}/impostazioni`, { impostazioni });
  return data.data.scuola;
};

/** DELETE /api/scuole/:id — elimina scuola (admin). Con `forza` elimina anche tutti i dati. */
export const deleteScuola = async (id, { forza = false } = {}) => {
  const { data } = await apiClient.delete(`/scuole/${id}`, {
    params: forza ? { forza: 'true' } : {},
  });
  return data;
};

/** POST /api/scuole/:id/blocca — sospende gli accessi alla scuola (admin). */
export const bloccaScuola = async (id) => {
  const { data } = await apiClient.post(`/scuole/${id}/blocca`);
  return data.data.scuola;
};

/** POST /api/scuole/:id/sblocca — riattiva gli accessi alla scuola (admin). */
export const sbloccaScuola = async (id) => {
  const { data } = await apiClient.post(`/scuole/${id}/sblocca`);
  return data.data.scuola;
};
