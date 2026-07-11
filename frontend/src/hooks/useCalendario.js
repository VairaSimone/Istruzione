import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as calendarioService from '../services/calendarioService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAuthenticated, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo CALENDARIO.
 *
 * Il FEED è accessibile a chiunque sia autenticato (studenti e insegnanti). La
 * GESTIONE degli eventi (elenco/dettaglio/mutazioni) è abilitata solo per chi
 * può gestire (insegnante/admin), così gli studenti non generano chiamate che
 * riceverebbero comunque 403.
 */

// ── Feed (tutti i ruoli) ──

export const useCalendarioFeed = (filters = {}) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.calendario.feed(filters),
    queryFn: () => calendarioService.getFeed(filters),
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  });
};

// ── Gestione eventi (insegnante/admin) ──

export const useEventiList = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.calendario.eventi(filters),
    queryFn: () => calendarioService.getEventi(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useEvento = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.calendario.eventoDetail(id),
    queryFn: () => calendarioService.getEventoById(id),
    enabled: canManage && Boolean(id),
  });
};

const useInvalidateCalendario = () => {
  const queryClient = useQueryClient();
  return (id) => {
    // Il feed unisce eventi e compiti: va sempre invalidato a ogni modifica.
    queryClient.invalidateQueries({ queryKey: queryKeys.calendario.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendario.eventoDetail(id) });
    }
  };
};

export const useCreateEvento = () => {
  const invalidate = useInvalidateCalendario();
  return useMutation({
    mutationFn: calendarioService.createEvento,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateEvento = () => {
  const invalidate = useInvalidateCalendario();
  return useMutation({
    mutationFn: calendarioService.updateEvento,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useDeleteEvento = () => {
  const invalidate = useInvalidateCalendario();
  return useMutation({
    mutationFn: calendarioService.deleteEvento,
    onSuccess: () => invalidate(),
  });
};

export const useAddDestinatario = () => {
  const invalidate = useInvalidateCalendario();
  return useMutation({
    mutationFn: calendarioService.addDestinatario,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useRemoveDestinatario = () => {
  const invalidate = useInvalidateCalendario();
  return useMutation({
    mutationFn: calendarioService.removeDestinatario,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};
