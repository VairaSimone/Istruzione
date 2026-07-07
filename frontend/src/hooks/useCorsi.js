import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as corsiService from '../services/corsiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo CORSI (videolezioni on-demand).
 *
 * Le query dello staff sono abilitate solo per chi può gestire
 * (insegnante/admin); quelle dello studente solo per gli studenti. Così ogni
 * ruolo evita di generare chiamate che riceverebbero comunque 403/404.
 */

const selectIsStudent = (state) => state.user?.ruolo === 'studente';

// ── Staff ──

export const useCorsiList = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.corsi.list(filters),
    queryFn: () => corsiService.getCorsi(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useCorso = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.corsi.detail(id),
    queryFn: () => corsiService.getCorsoById(id),
    enabled: canManage && Boolean(id),
  });
};

const useInvalidateCorsi = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.corsi.all });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.corsi.detail(id) });
  };
};

export const useCreateCorso = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.createCorso,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateCorso = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.updateCorso,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteCorso = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.deleteCorso,
    onSuccess: () => invalidate(),
  });
};

// ── Capitoli ──

export const useAddCapitolo = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.addCapitolo,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useUpdateCapitolo = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.updateCapitolo,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteCapitolo = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.deleteCapitolo,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

// ── Documenti ──

export const useAddDocumento = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.addDocumento,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteDocumento = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.deleteDocumento,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

// ── Disponibilità ──

export const useRendiDisponibile = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.rendiDisponibile,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useRevocaDisponibilita = () => {
  const invalidate = useInvalidateCorsi();
  return useMutation({
    mutationFn: corsiService.revocaDisponibilita,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

// ── Studente ──

export const useCorsiStudente = (filters = {}) => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.corsi.studente(filters),
    queryFn: () => corsiService.getCorsiStudente(filters),
    enabled: isStudent,
    placeholderData: (previousData) => previousData,
  });
};

export const useCorsoStudente = (id) => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.corsi.studenteDetail(id),
    queryFn: () => corsiService.getCorsoStudenteById(id),
    enabled: isStudent && Boolean(id),
  });
};
