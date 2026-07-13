import apiClient from '../api/axiosClient';

/**
 * Service layer dei DOMINI PERSONALIZZATI delle scuole.
 * Mappa 1:1 gli endpoint di `backend/src/routes/scuolaRoutes.js` (gruppo /domini).
 *
 * Due percorsi speculari, scelti in base al ruolo:
 *   - `/scuole/mia/domini`      → la PROPRIA scuola (staff): non serve l'id;
 *   - `/scuole/:scuolaId/domini` → una scuola indicata (admin): può VERIFICARE.
 *
 * Passando `scuolaId` si usa il percorso admin; senza, quello «mia».
 */

const base = (scuolaId) => (scuolaId ? `/scuole/${scuolaId}/domini` : '/scuole/mia/domini');

/** GET — elenco domini della scuola. */
export const getDomini = async (scuolaId) => {
  const { data } = await apiClient.get(base(scuolaId));
  return data.data.domini;
};

/** POST — aggiunge un dominio. Admin ⇒ già verificato; staff ⇒ da verificare. */
export const addDominio = async ({ scuolaId, dominio, principale, note }) => {
  const body = { dominio };
  if (principale !== undefined) body.principale = principale;
  if (note !== undefined) body.note = note;

  const { data } = await apiClient.post(base(scuolaId), body);
  return data.data.dominio;
};

/** PATCH — aggiorna verifica (solo admin) / principale / note. */
export const updateDominio = async ({ scuolaId, dominioId, verificato, principale, note }) => {
  const body = {};
  if (verificato !== undefined) body.verificato = verificato;
  if (principale !== undefined) body.principale = principale;
  if (note !== undefined) body.note = note;

  const { data } = await apiClient.patch(`${base(scuolaId)}/${dominioId}`, body);
  return data.data.dominio;
};

/** DELETE — rimuove un dominio. */
export const deleteDominio = async ({ scuolaId, dominioId }) => {
  const { data } = await apiClient.delete(`${base(scuolaId)}/${dominioId}`);
  return data;
};
