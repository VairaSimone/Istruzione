import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * Esporta i dati personali dell'utente e avvia il download del file JSON
 * (GET /me/esporta-dati). Il download è un effetto lato browser: lo eseguiamo
 * qui in `mutationFn`, dopo aver ricevuto il Blob dal service.
 */
export const useEsportaDati = () => {
  return useMutation({
    mutationFn: async () => {
      const { blob, filename } = await authService.esportaDati();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { filename };
    },
  });
};

/**
 * Programma la cancellazione dell'account (POST /me/richiesta-cancellazione).
 * Aggiorna lo store con l'utente aggiornato quando disponibile, così la UI
 * mostra subito lo stato "cancellazione programmata".
 */
export const useRichiediCancellazione = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: authService.richiediCancellazione,
    onSuccess: (data) => {
      const at = data?.data?.cancellazione_richiesta_at;
      if (at) {
        const current = useAuthStore.getState().user;
        if (current) {
          const updated = { ...current, cancellazione_richiesta_at: at };
          setUser(updated);
          queryClient.setQueryData(queryKeys.auth.me, updated);
        }
      }
    },
  });
};

/**
 * Annulla la richiesta di cancellazione pendente
 * (DELETE /me/richiesta-cancellazione).
 */
export const useAnnullaCancellazione = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: authService.annullaCancellazione,
    onSuccess: () => {
      const current = useAuthStore.getState().user;
      if (current) {
        const updated = { ...current, cancellazione_richiesta_at: null };
        setUser(updated);
        queryClient.setQueryData(queryKeys.auth.me, updated);
      }
    },
  });
};

/**
 * Legge le preferenze di notifica email dell'utente loggato
 * (GET /me/notifiche). Il backend restituisce il blob COMPLETO con i default
 * già applicati, quindi il componente non deve gestire chiavi mancanti.
 */
export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: queryKeys.auth.notifiche,
    queryFn: async () => {
      const data = await authService.getNotificationPreferences();
      return data.data.preferenze;
    },
  });
};

/**
 * Aggiorna le preferenze di notifica email (PATCH /me/notifiche).
 * Aggiorna la cache React Query con la versione normalizzata restituita dal
 * backend, così i toggle riflettono subito lo stato salvato (incluse le
 * eventuali propagazioni applicate lato server).
 */
export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.updateNotificationPreferences,
    onSuccess: (data) => {
      const preferenze = data.data.preferenze;
      queryClient.setQueryData(queryKeys.auth.notifiche, preferenze);
    },
  });
};
