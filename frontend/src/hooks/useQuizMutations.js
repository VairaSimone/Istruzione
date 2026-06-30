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
 * kana da rivedere cambiano) e il profilo badge (nuovi badge / progressi di
 * maestria possono essersi sbloccati nel round) così la home e il profilo si
 * aggiornano al rientro.
 */
export const useSubmitQuizResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quizService.submitQuizResults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.badge });
      // Heatmap, streak e caratteri problematici cambiano ad ogni round.
      queryClient.invalidateQueries({ queryKey: queryKeys.statistiche.all });
    },
  });
};

/**
 * Registra i tratti validati sul canvas di scrittura (POST /quiz/scrittura).
 * È una mutation perché muta lo stato lato server (XP scrittura, contatori,
 * badge). Al successo invalida dashboard e profilo badge.
 */
export const useRegistraScrittura = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quizService.registraScrittura,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.badge });
      // La scrittura aggiorna heatmap (tratti del giorno) ed errori di tratto.
      queryClient.invalidateQueries({ queryKey: queryKeys.statistiche.all });
    },
  });
};
