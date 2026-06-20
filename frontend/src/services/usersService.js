import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo di gestione utenti (sezione 4.3 della doc).
 * Tutti gli endpoint richiedono ruolo 'insegnante' — il controllo di
 * autorizzazione è comunque applicato server-side (authorizeRoles), il
 * frontend lo replica solo per UX (nascondere/disabilitare la UI).
 *
 * NOTA: l'endpoint GET /gestione/utenti supporta filtri reali via query
 * string (?ruolo=, ?classe=, ?nome=), confermati nel codice sorgente
 * (authService.getUtentiPerInsegnante) ma non esplicitati nella
 * documentazione fornita. NON supporta paginazione lato server
 * (findAll senza limit/offset) nonostante la doc lo lasci intendere:
 * qualsiasi paginazione necessaria va quindi gestita client-side.
 */

export const getAllUsers = async (filters = {}) => {
  const params = {};
  if (filters.ruolo) params.ruolo = filters.ruolo;
  if (filters.classe) params.classe = filters.classe;
  if (filters.nome) params.nome = filters.nome;

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
