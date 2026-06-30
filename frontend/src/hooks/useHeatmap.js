import { useQuery } from '@tanstack/react-query';
import * as statisticheService from '../services/statisticheService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Recupera la heatmap delle attività (GET /statistiche/heatmap): attività per
 * giorno per la griglia dei contributi stile GitHub.
 *
 * Abilitato di default: come tutte le statistiche è accessibile a qualsiasi
 * utente autenticato e attivo, senza gating per ruolo.
 *
 * @param {number} [giorni=365]
 * @param {{ enabled?: boolean }} [opts]
 */
export const useHeatmap = (giorni = 365, { enabled = true } = {}) => {
  return useQuery({
    queryKey: queryKeys.statistiche.heatmap(giorni),
    queryFn: async () => {
      const data = await statisticheService.getHeatmap(giorni);
      return data.data; // { dal, al, giorniRichiesti, massimoGiornaliero, giorni, riepilogo }
    },
    enabled,
  });
};
