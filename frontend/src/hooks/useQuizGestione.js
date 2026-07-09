import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as quizGestioneService from '../services/quizGestioneService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore, selectCanManage } from '../store/authStore';

/**
 * Hook dei QUIZ DELLE SCUOLE (template installabili + quiz personalizzati).
 *
 * Le query dello staff sono abilitate solo per insegnanti e admin, così gli
 * studenti non generano chiamate che riceverebbero 403. `GET /quiz/disponibili`
 * è invece aperto a tutti gli utenti autenticati: risponde con i quiz giocabili
 * dal richiedente, qualunque sia il suo ruolo.
 */

// ── Catalogo dei template di piattaforma (staff) ──

export const useTemplateQuiz = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.quiz.templates(filters),
    queryFn: () => quizGestioneService.getTemplateQuiz(filters),
    enabled: canManage,
  });
};

// ── Vista giocatore ──

export const useQuizDisponibili = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.quiz.disponibili(filters),
    queryFn: () => quizGestioneService.getQuizDisponibili(filters),
  });
};

// ── Staff: CRUD quiz ──

export const useQuizList = (filters = {}) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.quiz.gestioneList(filters),
    queryFn: () => quizGestioneService.getQuizList(filters),
    enabled: canManage,
    placeholderData: (previousData) => previousData,
  });
};

export const useQuizDettaglio = (id) => {
  const canManage = useAuthStore(selectCanManage);
  return useQuery({
    queryKey: queryKeys.quiz.gestioneDetail(id),
    queryFn: () => quizGestioneService.getQuizById(id),
    enabled: canManage && Boolean(id),
  });
};

/**
 * Invalidazioni comuni a ogni mutazione: la lista dello staff, il dettaglio del
 * quiz toccato, il catalogo dei template (il contatore delle installazioni
 * cambia) e l'elenco dei quiz giocabili.
 */
const useInvalidateQuizGestione = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quiz.gestione });
    queryClient.invalidateQueries({ queryKey: ['quiz', 'templates'] });
    queryClient.invalidateQueries({ queryKey: ['quiz', 'disponibili'] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz.gestioneDetail(id) });
    }
  };
};

export const useCreateQuiz = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.createQuiz,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateQuiz = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.updateQuiz,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteQuiz = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.deleteQuiz,
    onSuccess: () => invalidate(),
  });
};

// ── Staff: domande (solo quiz personalizzati) ──

export const useAddDomanda = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.addDomanda,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useUpdateDomanda = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.updateDomanda,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDeleteDomanda = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.deleteDomanda,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

// ── Staff: abilitazione presso le aule ──

export const useAbilitaPerAula = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.abilitaPerAula,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};

export const useDisabilitaPerAula = () => {
  const invalidate = useInvalidateQuizGestione();
  return useMutation({
    mutationFn: quizGestioneService.disabilitaPerAula,
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
};
