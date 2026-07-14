import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pagamentiService from '../services/pagamentiService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook del modulo PAGAMENTI.
 *
 * Le query dello studente (catalogo, propri acquisti) sono abilitate solo per
 * gli studenti; quelle dello staff (config, onboarding, incassi) solo per chi
 * può gestire. Così ogni ruolo evita chiamate che riceverebbero comunque 403.
 */

const selectIsStudent = (state) => state.user?.ruolo === 'studente';

// ── Studente ──

export const useCatalogo = () => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.pagamenti.catalogo,
    queryFn: pagamentiService.getCatalogo,
    enabled: isStudent,
  });
};

export const useMieiPagamenti = () => {
  const isStudent = useAuthStore(selectIsStudent);
  return useQuery({
    queryKey: queryKeys.pagamenti.miei,
    queryFn: pagamentiService.getMieiPagamenti,
    enabled: isStudent,
  });
};

/**
 * Avvia il checkout e reindirizza il browser all'URL Stripe restituito. Il
 * catalogo viene invalidato al ritorno (via useEsitoPagamento), non qui.
 */
export const useCreaCheckout = () => {
  return useMutation({
    mutationFn: pagamentiService.creaCheckout,
    onSuccess: (dati) => {
      if (dati?.url) window.location.assign(dati.url);
    },
  });
};

// ── Staff ──

export const useConfigPagamenti = (scuolaId) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.pagamenti.config(scuolaId),
    queryFn: () => pagamentiService.getConfig(scuolaId),
    enabled: canManage,
  });
};

const useInvalidateConfig = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.pagamenti.all });
};

export const useAggiornaConfigPagamenti = () => {
  const invalidate = useInvalidateConfig();
  return useMutation({
    mutationFn: pagamentiService.aggiornaConfig,
    onSuccess: () => invalidate(),
  });
};

export const useAvviaOnboarding = () => {
  return useMutation({
    mutationFn: pagamentiService.avviaOnboarding,
    onSuccess: (dati) => {
      if (dati?.url) window.location.assign(dati.url);
    },
  });
};

export const useSincronizzaOnboarding = () => {
  const invalidate = useInvalidateConfig();
  return useMutation({
    mutationFn: pagamentiService.getStatoOnboarding,
    onSuccess: () => invalidate(),
  });
};

export const usePagamentiScuola = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.pagamenti.scuola(filters),
    queryFn: () => pagamentiService.getPagamentiScuola(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};
