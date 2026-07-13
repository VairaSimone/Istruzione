import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as contattiService from '../services/contattiService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook delle RICHIESTE DI CONTATTO.
 *
 *   - `useInviaRichiesta`  → invio pubblico dal form della homepage (nessuna auth);
 *   - `useRichieste` / `useRichiesta` → lettura per lo staff;
 *   - mutation di aggiornamento/eliminazione → gestione dei lead.
 *
 * Le liste dipendono dai filtri (incluso lo `scuolaId` che l'admin usa per
 * scegliere il tenant), così cambiare filtro non riusa una cache sbagliata.
 */

/** Invio pubblico. Non invalida cache: il visitatore non ha viste da aggiornare. */
export const useInviaRichiesta = () =>
  useMutation({ mutationFn: contattiService.inviaRichiesta });

/** Elenco lead (staff/admin). `enabled` per non interrogare finché mancano i requisiti. */
export const useRichieste = (filters = {}, opzioni = {}) =>
  useQuery({
    queryKey: queryKeys.contatti.list(filters),
    queryFn: () => contattiService.getRichieste(filters),
    enabled: opzioni.enabled ?? true,
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });

/** Dettaglio di un lead. */
export const useRichiesta = (id, opzioni = {}) =>
  useQuery({
    queryKey: queryKeys.contatti.detail(id),
    queryFn: () => contattiService.getRichiesta(id),
    enabled: Boolean(id) && (opzioni.enabled ?? true),
  });

const useInvalidateContatti = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contatti.all });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.contatti.detail(id) });
  };
};

export const useUpdateRichiesta = () => {
  const invalidate = useInvalidateContatti();
  return useMutation({
    mutationFn: contattiService.updateRichiesta,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteRichiesta = () => {
  const invalidate = useInvalidateContatti();
  return useMutation({
    mutationFn: contattiService.deleteRichiesta,
    onSuccess: () => invalidate(),
  });
};
