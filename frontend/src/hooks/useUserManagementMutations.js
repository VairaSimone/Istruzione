import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as usersService from '../services/usersService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Cambia il ruolo di un utente (solo insegnanti). Invalida la lista utenti
 * per riflettere immediatamente il nuovo ruolo nella tabella di gestione.
 */
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};

/**
 * Elimina forzatamente l'account di un altro utente (solo insegnanti).
 * Invalida la lista utenti per rimuovere la riga eliminata dalla tabella.
 */
export const useDeleteUserByTeacher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.deleteUserByTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};
