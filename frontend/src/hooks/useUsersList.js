import { useQuery } from '@tanstack/react-query';
import * as usersService from '../services/usersService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsTeacher } from '../store/authStore';

/**
 * Recupera la lista utenti per la dashboard di gestione (solo insegnanti).
 * `enabled: isTeacher` evita di sparare la richiesta (che riceverebbe
 * comunque 403 dal backend) per utenti con ruolo 'studente'.
 */
export const useUsersList = (filters = {}) => {
  const isTeacher = useAuthStore(selectIsTeacher);

  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const data = await usersService.getAllUsers(filters);
      return data.data.utenti;
    },
    enabled: isTeacher,
    placeholderData: (previousData) => previousData, // evita flicker quando si cambiano i filtri
  });
};
