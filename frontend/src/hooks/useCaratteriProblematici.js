import { useQuery } from '@tanstack/react-query';
import * as statisticheService from '../services/statisticheService';
import { queryKeys } from '../constants/queryKeys';
import { useFunzionalitaAttiva } from './useConfig';
import { FUNZIONALITA } from '../constants/funzionalita';

/**
 * Recupera i caratteri problematici dell'utente
 * (GET /statistiche/caratteri-problematici): kana su cui sbaglia di più, per
 * risposta o per ordine dei tratti, ordinati per gravità.
 *
 * @param {{ alfabeto?: string, limite?: number }} [filtri]
 * @param {{ enabled?: boolean }} [opts]
 */
export const useCaratteriProblematici = (filtri = {}, { enabled = true } = {}) => {
  // Protetto dal gate di sezione `statistiche` lato backend.
  const statisticheAttive = useFunzionalitaAttiva(FUNZIONALITA.STATISTICHE);

  return useQuery({
    queryKey: queryKeys.statistiche.caratteriProblematici(filtri),
    queryFn: async () => {
      const data = await statisticheService.getCaratteriProblematici(filtri);
      return data.data; // { caratteri, riepilogo }
    },
    enabled: enabled && statisticheAttive,
  });
};
