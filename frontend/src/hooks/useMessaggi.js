import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as messaggiService from '../services/messaggiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAuthenticated, selectCanManage } from '../store/authStore';

// ── Notifiche (polling leggero) ──
export const useNotifiche = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.messaggi.notifiche,
    queryFn: messaggiService.getNotifiche,
    enabled: isAuthenticated,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

// ── Inbox / posta / note ──
export const useRicevuti = (filters = {}) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.messaggi.ricevuti(filters),
    queryFn: () => messaggiService.getRicevuti(filters),
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  });
};

export const useInviati = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.messaggi.inviati(filters),
    queryFn: () => messaggiService.getInviati(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useNote = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.messaggi.note(filters),
    queryFn: () => messaggiService.getNote(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useMessaggio = (id) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.messaggi.detail(id),
    queryFn: () => messaggiService.getMessaggio(id),
    enabled: isAuthenticated && Boolean(id),
  });
};

// ── Mutation ──
const useInvalidateMessaggi = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.messaggi.all });
};

export const useInviaMessaggio = () => {
  const invalidate = useInvalidateMessaggi();
  return useMutation({ mutationFn: messaggiService.inviaMessaggio, onSuccess: invalidate });
};

export const useInviaFeedbackCompito = () => {
  const invalidate = useInvalidateMessaggi();
  return useMutation({ mutationFn: messaggiService.inviaFeedbackCompito, onSuccess: invalidate });
};

export const useRispondi = () => {
  const invalidate = useInvalidateMessaggi();
  return useMutation({ mutationFn: messaggiService.rispondi, onSuccess: invalidate });
};

export const useSegnaLetto = () => {
  const invalidate = useInvalidateMessaggi();
  return useMutation({ mutationFn: messaggiService.segnaLetto, onSuccess: invalidate });
};

export const useEliminaMessaggio = () => {
  const invalidate = useInvalidateMessaggi();
  return useMutation({ mutationFn: messaggiService.eliminaMessaggio, onSuccess: invalidate });
};
