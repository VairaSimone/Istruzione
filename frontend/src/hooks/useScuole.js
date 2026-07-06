import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as scuoleService from '../services/scuoleService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectIsAdmin, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo SCUOLE (multi-tenant).
 *
 * - `useScuoleList` / mutation di scrittura → solo admin (query abilitate via
 *   `enabled: isAdmin` per non generare 403 per gli altri ruoli);
 * - `useMiaScuola` → insegnante/admin: la propria scuola (per l'admin: null).
 */

/** Elenco scuole (solo admin). */
export const useScuoleList = (filters = {}) => {
  const isAdmin = useAuthStore(selectIsAdmin);
  return useQuery({
    queryKey: queryKeys.scuole.list(filters),
    queryFn: () => scuoleService.getScuole(filters),
    enabled: isAdmin,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Scuola del richiedente. Abilitata per chi può gestire (insegnante/admin).
 * Utile per mostrare il contesto "Scuola: X" e per il default nei form.
 */
export const useMiaScuola = () => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.scuole.mia,
    queryFn: scuoleService.getMiaScuola,
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
  });
};

const useInvalidateScuole = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.all });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.scuole.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.mia });
  };
};

export const useCreateScuola = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.createScuola,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateScuola = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.updateScuola,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useUpdateImpostazioni = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.updateImpostazioni,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteScuola = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.deleteScuola,
    onSuccess: () => invalidate(),
  });
};
