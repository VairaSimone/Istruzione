import { useQuery } from '@tanstack/react-query';
import * as statisticheService from '../services/statisticheService';
import { queryKeys } from '../constants/queryKeys';
import { useFunzionalitaAttiva } from './useConfig';
import { FUNZIONALITA } from '../constants/funzionalita';

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
  // Protetto dal gate di sezione `statistiche` lato backend.
  const statisticheAttive = useFunzionalitaAttiva(FUNZIONALITA.STATISTICHE);

  return useQuery({
    queryKey: queryKeys.statistiche.heatmap(giorni),
    queryFn: async () => {
      const data = await statisticheService.getHeatmap(giorni);
      return data.data; // { dal, al, giorniRichiesti, massimoGiornaliero, giorni, riepilogo }
    },
    enabled: enabled && statisticheAttive,
  });
};
