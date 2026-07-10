import { useQuery } from '@tanstack/react-query';
import * as quizService from '../services/quizService';
import { queryKeys } from '../constants/queryKeys';
import { useFunzionalitaAttiva } from './useConfig';
import { FUNZIONALITA } from '../constants/funzionalita';

/**
 * Recupera il profilo badge del Quiz Kana (GET /quiz/badge): catalogo completo
 * con stato di sblocco, statistiche di gioco e totali per le barre di
 * progresso (maestria hiragana/katakana, righe sbloccate).
 *
 * L'endpoint è protetto dal gate di sezione `gamification`: se la scuola non usa
 * punti, livelli e obiettivi, la query non parte affatto.
 *
 * @param {{ enabled?: boolean }} [opts]
 */
export const useQuizBadge = ({ enabled = true } = {}) => {
  const gamificationAttiva = useFunzionalitaAttiva(FUNZIONALITA.GAMIFICATION);

  return useQuery({
    queryKey: queryKeys.quiz.badge,
    queryFn: async () => {
      const data = await quizService.getQuizBadge();
      return data.data; // { statistiche, badge, riepilogo, progresso }
    },
    enabled: enabled && gamificationAttiva,
  });
};
