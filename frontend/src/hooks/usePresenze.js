import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as presenzeService from '../services/presenzeService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAuthenticated, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo REGISTRO PRESENZE.
 *
 * La VISTA STUDENTE (`useMiePresenze`) è per chiunque sia autenticato. La
 * GESTIONE (elenco appelli, dettaglio, riepilogo, mutazioni) è abilitata solo
 * per chi può gestire (insegnante/admin), così gli studenti non generano
 * chiamate che riceverebbero comunque 403.
 */

// ── Vista studente ──

export const useMiePresenze = (filters = {}) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: queryKeys.presenze.mie(filters),
    queryFn: () => presenzeService.getMiePresenze(filters),
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  });
};

// ── Gestione appelli (insegnante/admin) ──

export const useRegistri = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.presenze.registri(filters),
    queryFn: () => presenzeService.getRegistri(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useRegistro = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.presenze.registroDetail(id),
    queryFn: () => presenzeService.getRegistroById(id),
    enabled: canManage && Boolean(id),
  });
};

export const useRiepilogoAula = (classeId) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.presenze.riepilogo(classeId),
    queryFn: () => presenzeService.getRiepilogoAula(classeId),
    enabled: canManage && Boolean(classeId),
  });
};

const useInvalidatePresenze = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.presenze.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.presenze.registroDetail(id) });
    }
  };
};

export const useCreateRegistro = () => {
  const invalidate = useInvalidatePresenze();
  return useMutation({
    mutationFn: presenzeService.createRegistro,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateRegistro = () => {
  const invalidate = useInvalidatePresenze();
  return useMutation({
    mutationFn: presenzeService.updateRegistro,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useDeleteRegistro = () => {
  const invalidate = useInvalidatePresenze();
  return useMutation({
    mutationFn: presenzeService.deleteRegistro,
    onSuccess: () => invalidate(),
  });
};

export const useSaveVoci = () => {
  const invalidate = useInvalidatePresenze();
  return useMutation({
    mutationFn: presenzeService.saveVoci,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};
