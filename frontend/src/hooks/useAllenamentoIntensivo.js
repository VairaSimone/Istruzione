import { useMutation } from '@tanstack/react-query';
import * as statisticheService from '../services/statisticheService';

/**
 * Genera il pool di Allenamento Intensivo
 * (POST /statistiche/allenamento-intensivo).
 *
 * È una mutation perché i filtri viaggiano nel body, ma lato server è di sola
 * lettura: non muta lo stato e non invalida nulla. L'esito della partita verrà
 * poi inviato al normale POST /quiz/submit (che aggiorna SRS/XP/streak).
 */
export const useAllenamentoIntensivo = () => {
  return useMutation({
    mutationFn: statisticheService.generaAllenamentoIntensivo,
  });
};
