import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo di gestione utenti.
 * Tutti gli endpoint richiedono ruolo 'insegnante'/'admin' — il controllo di
 * autorizzazione è comunque applicato server-side (authorizeRoles), il
 * frontend lo replica solo per UX (nascondere/disabilitare la UI).
 *
 * GET /auth/gestione/utenti supporta:
 *   - filtri:      ?ruolo=  ?classe=  ?nome=
 *   - paginazione: ?page=   ?limit=
 * Quando page/limit sono presenti il backend risponde con findAndCountAll e
 * include un blocco `paginazione` { paginaCorrente, elementiPerPagina,
 * totaleElementi, totalePagine }. Senza page/limit restituisce l'elenco intero.
 */

export const getAllUsers = async (filters = {}) => {
  const params = {};
  if (filters.ruolo) params.ruolo = filters.ruolo;
  if (filters.classe) params.classe = filters.classe;
  if (filters.nome) params.nome = filters.nome;
  // Paginazione server-side: inviati solo se valorizzati, così il resto del
  // codice può continuare a chiamare getAllUsers senza pagina per liste piccole.
  if (filters.page != null) params.page = filters.page;
  if (filters.limit != null) params.limit = filters.limit;

  const { data } = await apiClient.get('/auth/gestione/utenti', { params });
  return data;
};

export const updateUserRole = async ({ id, ruolo }) => {
  const { data } = await apiClient.patch(`/auth/gestione/utenti/${id}/ruolo`, {
    ruolo,
  });
  return data;
};

export const deleteUserByTeacher = async (id) => {
  const { data } = await apiClient.delete(`/auth/gestione/utenti/${id}`);
  return data;
};
