import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/authStore';

/**
 * Aggiorna la lingua di preferenza dell'utente loggato (PATCH /me/lingua).
 * Aggiorna sia la cache React Query che lo store Zustand, per coerenza
 * immediata della UI senza dover attendere un refetch.
 */
export const useUpdateLanguage = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: authService.updateLanguage,
    onSuccess: (data) => {
      const updatedUser = data.data.utente;
      setUser(updatedUser);
      queryClient.setQueryData(queryKeys.auth.me, updatedUser);
    },
  });
};

/**
 * Avvia la richiesta di cambio email (POST /request-email-change).
 * Non modifica l'email corrente: il backend salva la nuova email in un
 * campo temporaneo (nuova_email_pendente) e invia un link di conferma
 * alla NUOVA casella postale. La conferma avviene fuori dal flusso React
 * (click sul link email -> redirect del backend), vedi VerifyEmailChangePage.
 */
export const useRequestEmailChange = () => {
  return useMutation({
    mutationFn: authService.requestEmailChange,
  });
};

/**
 * Elimina definitivamente l'account dell'utente loggato (DELETE /me).
 * Il backend NON cancella i cookie lato server per questa azione (a
 * differenza di /logout) — il frontend deve quindi pulire esplicitamente
 * stato locale e cache dopo il successo.
 */
export const useDeleteMyAccount = () => {
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((state) => state.clearUser);

  return useMutation({
    mutationFn: authService.deleteMe,
    onSuccess: () => {
      clearUser();
      queryClient.clear();
    },
  });
};
