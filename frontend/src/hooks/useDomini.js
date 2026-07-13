import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as dominiService from '../services/dominiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook dei DOMINI PERSONALIZZATI di una scuola.
 *
 * Se si passa `scuolaId` si opera sulla scuola indicata (percorso admin, con
 * possibilità di verifica); senza, sulla propria scuola (staff).
 *
 * Ogni scrittura invalida ANCHE la configurazione pubblica: un dominio appena
 * verificato cambia la risoluzione del tenant e il CORS, quindi il branding
 * pubblico va rifatto.
 */

export const useDomini = (scuolaId) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.scuole.domini(scuolaId),
    queryFn: () => dominiService.getDomini(scuolaId),
    enabled: canManage,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

const useInvalidateDomini = () => {
  const queryClient = useQueryClient();
  return (scuolaId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scuole.domini(scuolaId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
  };
};

export const useAddDominio = () => {
  const invalidate = useInvalidateDomini();
  return useMutation({
    mutationFn: dominiService.addDominio,
    onSuccess: (_data, variables) => invalidate(variables.scuolaId),
  });
};

export const useUpdateDominio = () => {
  const invalidate = useInvalidateDomini();
  return useMutation({
    mutationFn: dominiService.updateDominio,
    onSuccess: (_data, variables) => invalidate(variables.scuolaId),
  });
};

export const useDeleteDominio = () => {
  const invalidate = useInvalidateDomini();
  return useMutation({
    mutationFn: dominiService.deleteDominio,
    onSuccess: (_data, variables) => invalidate(variables.scuolaId),
  });
};
