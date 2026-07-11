import { useQuery } from '@tanstack/react-query';
import * as usersService from '../services/usersService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsTeacher } from '../store/authStore';

/**
 * Recupera la lista utenti per la dashboard di gestione (insegnanti/admin).
 * `enabled: isTeacher` evita di sparare la richiesta (che riceverebbe
 * comunque 403 dal backend) per utenti con ruolo 'studente'.
 *
 * Restituisce sia gli `utenti` della pagina corrente sia il blocco
 * `paginazione` (quando `filters` contiene page/limit). `placeholderData`
 * mantiene la pagina precedente visibile durante il cambio pagina/filtro,
 * evitando lo sfarfallio.
 */
export const useUsersList = (filters = {}) => {
  const isTeacher = useAuthStore(selectIsTeacher);

  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const data = await usersService.getAllUsers(filters);
      return {
        utenti: data.data.utenti,
        paginazione: data.paginazione ?? null,
      };
    },
    enabled: isTeacher,
    placeholderData: (previousData) => previousData, // evita flicker su cambio pagina/filtri
  });
};
