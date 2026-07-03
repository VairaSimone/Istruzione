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

/**
 * Recupera l'ordine dei tratti di tutti i kanji di un livello JLPT
 * (GET /quiz/stroke/kanji/:livello). Speculare a `useStrokeOrder` ma per i
 * kanji: i dati sono STATICI (KanjiVG) e la cache è quindi permanente.
 *
 * I livelli non ancora coperti dai dati dei tratti restituiscono
 * `caratteri: []`: il chiamante mostra in tal caso uno stato "non disponibile".
 *
 * @param {string} livello 'N5'…'N1'
 * @param {string} [lingua] 'it' | 'en' (per i significati mostrati)
 * @param {{ enabled?: boolean }} [opts]
 */
export const useStrokeOrderKanji = (livello, lingua, { enabled = true } = {}) => {
  return useQuery({
    queryKey: queryKeys.quiz.strokeOrderKanji(livello, lingua),
    queryFn: async () => {
      const data = await quizService.getStrokeOrderKanji(livello, lingua);
      return data.data.ordineTratti; // { livello, viewBox, licenza, totale, caratteri }
    },
    enabled: Boolean(livello) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
