import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '../services/dashboardDocenteService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Cruscotto aggregato: globale (unione delle proprie aule; admin → tutto)
 * oppure per singola aula. Abilitato solo per insegnante/admin.
 */
export const useDashboardDocente = ({ classeId, giorni, limite } = {}) => {
  const canManage = useAuthStore(selectCanManage);
  const opzioni = { giorni, limite };

  return useQuery({
    queryKey: classeId
      ? queryKeys.dashboard.aula(classeId, opzioni)
      : queryKeys.dashboard.globale(opzioni),
    queryFn: () =>
      classeId
        ? dashboardService.getDashboardAula(classeId, opzioni)
        : dashboardService.getDashboardGlobale(opzioni),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};
