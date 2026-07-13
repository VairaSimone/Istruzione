import apiClient from '../api/axiosClient';

/**
 * Service layer delle RICHIESTE DI CONTATTO.
 * Mappa 1:1 gli endpoint di `backend/src/routes/contattiRoutes.js`.
 *
 *   - INVIO pubblico dal form della homepage: nessuna autenticazione. La scuola
 *     destinataria è risolta lato server dal DOMINIO o dal tenant indicato
 *     (l'header `X-Scuola` viene aggiunto da `axiosClient` sul dominio globale).
 *   - GESTIONE dei lead: riservata allo staff/admin.
 */

/**
 * POST /api/contatti — invia una richiesta dal form pubblico.
 * @param {{tipo?:string, nome:string, email:string, telefono?:string, messaggio?:string, website?:string}} payload
 * @returns {Promise<{id:string, messaggioConferma:string|null}>}
 */
export const inviaRichiesta = async (payload) => {
  const { data } = await apiClient.post('/contatti', payload);
  return data.data;
};

/** GET /api/contatti — elenco lead (staff/admin). L'admin passa `scuolaId`. */
export const getRichieste = async (filters = {}) => {
  const params = {};
  if (filters.scuolaId) params.scuolaId = filters.scuolaId;
  if (filters.stato) params.stato = filters.stato;
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/contatti', { params });
  return { richieste: data.data.richieste, paginazione: data.paginazione ?? null };
};

/** GET /api/contatti/:id — dettaglio (staff/admin). */
export const getRichiesta = async (id) => {
  const { data } = await apiClient.get(`/contatti/${id}`);
  return data.data.richiesta;
};

/**
 * PATCH /api/contatti/:id — aggiorna stato / presa in carico / note.
 * @param {{id:string, stato?:string, noteInterne?:string|null, prendiInCarico?:boolean}} payload
 */
export const updateRichiesta = async ({ id, stato, noteInterne, prendiInCarico }) => {
  const body = {};
  if (stato !== undefined) body.stato = stato;
  if (noteInterne !== undefined) body.noteInterne = noteInterne;
  if (prendiInCarico !== undefined) body.prendiInCarico = prendiInCarico;

  const { data } = await apiClient.patch(`/contatti/${id}`, body);
  return data.data.richiesta;
};

/** DELETE /api/contatti/:id — rimuove un lead (staff/admin). */
export const deleteRichiesta = async (id) => {
  const { data } = await apiClient.delete(`/contatti/${id}`);
  return data;
};
