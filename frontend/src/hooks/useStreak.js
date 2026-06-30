import { useQuery } from '@tanstack/react-query';
import * as statisticheService from '../services/statisticheService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Recupera lo stato della streak di studio (GET /statistiche/streak): streak
 * corrente effettiva, record, ultima data di studio e flag di rischio.
 *
 * Abilitato di default. La streak corrente è già "effettiva" lato server
 * (azzerata se l'ultimo studio è anteriore a ieri), quindi non va ricalcolata.
 *
 * @param {{ enabled?: boolean }} [opts]
 */
export const useStreak = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: queryKeys.statistiche.streak,
    queryFn: async () => {
      const data = await statisticheService.getStreak();
      return data.data; // { streak, streakRecord, ultimaDataStudio, attivaOggi, aRischio }
    },
    enabled,
  });
};
