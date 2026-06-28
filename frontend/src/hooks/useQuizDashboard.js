import { useQuery } from '@tanstack/react-query';
import * as quizService from '../services/quizService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Recupera la dashboard del Quiz Kana (GET /quiz/dashboard): statistiche di
 * gioco, conteggio kana padroneggiati e lista dei caratteri da rivedere.
 *
 * Abilitato di default: tutte le route quiz sono accessibili a qualsiasi
 * utente autenticato e attivo, quindi nessun gating per ruolo.
 */
export const useQuizDashboard = () => {
  return useQuery({
    queryKey: queryKeys.quiz.dashboard,
    queryFn: async () => {
      const data = await quizService.getQuizDashboard();
      return data.data; // { statistiche, mastered, peggioriKana }
    },
  });
};
