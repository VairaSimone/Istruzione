import { useQuery } from '@tanstack/react-query';
import * as quizService from '../services/quizService';
import { queryKeys } from '../constants/queryKeys';
import { useFunzionalitaAttiva } from './useConfig';
import { FUNZIONALITA } from '../constants/funzionalita';

/**
 * Recupera il cruscotto personale del quiz (GET /quiz/dashboard): statistiche
 * di gioco, caratteri padroneggiati e lista di quelli da rivedere.
 *
 * L'endpoint è protetto dal gate di sezione `statistiche`: una scuola che l'ha
 * disattivata risponde 403. Disabilitiamo la query invece di lasciarla fallire,
 * così React Query non entra in un ciclo di retry su un errore permanente.
 */
export const useQuizDashboard = ({ enabled = true } = {}) => {
  const statisticheAttive = useFunzionalitaAttiva(FUNZIONALITA.STATISTICHE);

  return useQuery({
    queryKey: queryKeys.quiz.dashboard,
    queryFn: async () => {
      const data = await quizService.getQuizDashboard();
      return data.data; // { statistiche, mastered, peggioriKana }
    },
    enabled: enabled && statisticheAttive,
  });
};
