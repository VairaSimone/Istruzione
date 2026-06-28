import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as quizService from '../services/quizService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Genera una nuova sessione di quiz (POST /quiz/generate).
 * È una mutation perché i filtri viaggiano nel body, ma lato server è di sola
 * lettura: non invalida nulla.
 */
export const useGenerateQuiz = () => {
  return useMutation({
    mutationFn: quizService.generateQuiz,
  });
};

/**
 * Invia l'esito della partita (POST /quiz/submit).
 * Al successo invalida la dashboard del quiz (XP, streak, record, mastered e
 * kana da rivedere cambiano) così la home si aggiorna al rientro.
 */
export const useSubmitQuizResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quizService.submitQuizResults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.dashboard });
    },
  });
};
