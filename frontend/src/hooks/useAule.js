import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as auleService from '../services/auleService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo AULE. Le query sono abilitate solo per chi può gestire
 * (insegnante/admin), così gli studenti non generano chiamate che
 * riceverebbero comunque 403.
 */

export const useAuleList = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.aule.list(filters),
    queryFn: () => auleService.getAule(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useAula = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.aule.detail(id),
    queryFn: () => auleService.getAulaById(id),
    enabled: canManage && Boolean(id),
  });
};

const useInvalidateAule = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.aule.all });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.aule.detail(id) });
  };
};

export const useCreateAula = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.createAula,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateAula = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.updateAula,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteAula = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.deleteAula,
    onSuccess: () => invalidate(),
  });
};

export const useAddStudent = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.addStudent,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useRemoveStudent = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.removeStudent,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useAddTeacher = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.addTeacher,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useRemoveTeacher = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.removeTeacher,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useInviteStudent = () => {
  const invalidate = useInvalidateAule();
  return useMutation({
    mutationFn: auleService.inviteStudent,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};
