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

/**
 * Occupazione quota della PROPRIA scuola (insegnante/admin di scuola).
 * Storage/utenti/insegnanti: usato vs limite. Refresh più frequente perché
 * cambia con gli upload e i nuovi inviti.
 */
export const useMiaQuota = () => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.scuole.miaQuota,
    queryFn: scuoleService.getMiaQuota,
    enabled: canManage,
    staleTime: 30 * 1000,
  });
};

/** Occupazione quota di una scuola indicata (solo admin). */
export const useQuotaScuola = (id) => {
  const isAdmin = useAuthStore(selectIsAdmin);
  return useQuery({
    queryKey: queryKeys.scuole.quota(id),
    queryFn: () => scuoleService.getQuotaScuola(id),
    enabled: isAdmin && Boolean(id),
    staleTime: 30 * 1000,
  });
};

const useInvalidateScuole = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.all });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.scuole.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.mia });
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.miaQuota });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.scuole.quota(id) });
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
    // Accetta `{ id, forza }`: con `forza` elimina anche tutti i dati della scuola.
    mutationFn: ({ id, forza = false }) => scuoleService.deleteScuola(id, { forza }),
    onSuccess: () => invalidate(),
  });
};

export const useBloccaScuola = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.bloccaScuola,
    onSuccess: (_data, id) => invalidate(id),
  });
};

export const useSbloccaScuola = () => {
  const invalidate = useInvalidateScuole();
  return useMutation({
    mutationFn: scuoleService.sbloccaScuola,
    onSuccess: (_data, id) => invalidate(id),
  });
};
