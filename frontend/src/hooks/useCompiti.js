import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as compitiService from '../services/compitiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

const selectIsStudent = (state) => state.user?.ruolo === 'studente';

// ── Docente ──

export const useCompitiList = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.compiti.list(filters),
    queryFn: () => compitiService.getCompiti(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useCompito = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.compiti.detail(id),
    queryFn: () => compitiService.getCompitoById(id),
    enabled: canManage && Boolean(id),
  });
};

export const useConsegne = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.compiti.consegne(id),
    queryFn: () => compitiService.getConsegne(id),
    enabled: canManage && Boolean(id),
  });
};

const useInvalidateCompiti = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.compiti.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.compiti.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.compiti.consegne(id) });
    }
  };
};

export const useCreateCompito = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.createCompito,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateCompito = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.updateCompito,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useDeleteCompito = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.deleteCompito,
    onSuccess: () => invalidate(),
  });
};

export const useAddAssegnazione = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.addAssegnazione,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useRemoveAssegnazione = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.removeAssegnazione,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

export const useValutaConsegna = () => {
  const invalidate = useInvalidateCompiti();
  return useMutation({
    mutationFn: compitiService.valutaConsegna,
    onSuccess: (_d, variables) => invalidate(variables.id),
  });
};

// ── Studente ──

export const useCompitiStudente = (filters = {}) => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.compiti.studente(filters),
    queryFn: () => compitiService.getCompitiStudente(filters),
    enabled: isStudent,
    placeholderData: (previousData) => previousData,
  });
};

export const useCompitoStudente = (id) => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.compiti.studenteDetail(id),
    queryFn: () => compitiService.getCompitoStudenteById(id),
    enabled: isStudent && Boolean(id),
  });
};

export const useConsegnaCompito = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: compitiService.consegnaCompito,
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.compiti.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.compiti.studenteDetail(variables.id),
      });
    },
  });
};
