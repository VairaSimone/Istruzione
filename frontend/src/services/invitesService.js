import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo INVITI.
 * Ogni funzione mappa 1:1 un endpoint reale di `backend/src/routes/inviteRoutes.js`.
 *
 * Autorizzazione (replicata lato UI solo per UX, applicata comunque server-side):
 *   - creazione invito studente → insegnante o admin;
 *   - creazione invito insegnante → solo admin;
 *   - validazione token → pubblica.
 */

/** POST /api/invites/student — { email, classe, scuolaId? } */
export const createStudentInvite = async ({ email, classe, scuolaId }) => {
  const body = { email, classe, ...(scuolaId ? { scuolaId } : {}) };
  const { data } = await apiClient.post('/invites/student', body);
  return data;
};

/** POST /api/invites/teacher — { email, scuolaId } (solo admin) */
export const createTeacherInvite = async ({ email, scuolaId }) => {
  const { data } = await apiClient.post('/invites/teacher', { email, scuolaId });
  return data;
};

/**
 * GET /api/invites/validate/:token — pubblica.
 * Ritorna { email, ruolo, classe, scadenza } per pre-compilare il form di
 * completamento registrazione. Lancia in caso di token non valido/scaduto/usato.
 */
export const validateInviteToken = async (token) => {
  const { data } = await apiClient.get(`/invites/validate/${encodeURIComponent(token)}`);
  return data.data.invito;
};

/** GET /api/invites — elenco inviti (filtri: stato, ruolo, email). */
export const getInvites = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.ruolo) params.ruolo = filters.ruolo;
  if (filters.email) params.email = filters.email;

  const { data } = await apiClient.get('/invites', { params });
  return data.data.inviti;
};

/** DELETE /api/invites/:id — revoca un invito pendente. */
export const revokeInvite = async (id) => {
  const { data } = await apiClient.delete(`/invites/${id}`);
  return data;
};
