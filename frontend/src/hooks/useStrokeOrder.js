import { useQuery } from '@tanstack/react-query';
import * as quizService from '../services/quizService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Recupera l'ordine dei tratti di tutti i kana di un alfabeto
 * (GET /quiz/stroke/:alfabeto).
 *
 * I dati sono STATICI (derivati da KanjiVG, non dipendono dall'utente): la
 * cache è quindi praticamente permanente (`staleVarchar`/gcTime infiniti),
 * così cambiare carattere o tornare alla pratica non rigenera richieste.
 *
 * @param {string} alfabeto 'hiragana' | 'katakana'
 * @param {{ enabled?: boolean }} [opts]
 */
export const useStrokeOrder = (alfabeto, { enabled = true } = {}) => {
  return useQuery({
    queryKey: queryKeys.quiz.strokeOrder(alfabeto),
    queryFn: async () => {
      const data = await quizService.getStrokeOrder(alfabeto);
      return data.data.ordineTratti; // { alfabeto, viewBox, licenza, totale, caratteri }
    },
    enabled: Boolean(alfabeto) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
