import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as chatService from '../services/chatService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';

/**
 * Hook della CHAT D'AULA.
 *
 * Il feed non è realtime (niente websocket): si tiene aggiornato con un polling
 * leggero e con l'invalidazione della cache dopo ogni invio/eliminazione,
 * coerentemente col resto della piattaforma (cfr. notifiche messaggi).
 */

// ── Conteggio non letti (badge in navbar), polling leggero ──
export const useChatNotifiche = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.chat.notifiche,
    queryFn: chatService.getNotifiche,
    enabled: isAuthenticated,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

// ── Elenco delle mie aule con chat (anteprima + non letti) ──
export const useChatAule = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.chat.aule,
    queryFn: chatService.getAule,
    enabled: isAuthenticated,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

// ── Feed di un'aula (ultimi messaggi), polling per i nuovi ──
export const useChatMessaggi = (classeId, filtri = {}) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.chat.messaggi(classeId, filtri),
    queryFn: () => chatService.getMessaggi({ classeId, ...filtri }),
    enabled: isAuthenticated && Boolean(classeId),
    refetchInterval: 20 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
};

// ── Mutation ──
const useInvalidaChat = () => {
  const queryClient = useQueryClient();
  return (classeId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.messaggi(classeId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.aule });
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.notifiche });
  };
};

export const useInviaMessaggioChat = () => {
  const invalida = useInvalidaChat();
  return useMutation({
    mutationFn: chatService.inviaMessaggio,
    onSuccess: (_data, variabili) => invalida(variabili.classeId),
  });
};

export const useInviaAllegatoChat = () => {
  const invalida = useInvalidaChat();
  return useMutation({
    mutationFn: chatService.inviaAllegato,
    onSuccess: (_data, variabili) => invalida(variabili.classeId),
  });
};

export const useSegnaLettoChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.segnaLetto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.aule });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.notifiche });
    },
  });
};

export const useEliminaMessaggioChat = () => {
  const invalida = useInvalidaChat();
  return useMutation({
    mutationFn: chatService.eliminaMessaggio,
    onSuccess: (_data, variabili) => invalida(variabili.classeId),
  });
};
