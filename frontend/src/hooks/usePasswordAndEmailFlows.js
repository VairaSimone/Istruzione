import * as authService from '../services/authService';
import { useMutation, useQuery } from '@tanstack/react-query';

/**
 * Mutation per la richiesta di reset password. Il backend risponde sempre
 * con 200 e messaggio generico, indipendentemente dall'esistenza
 * dell'email (anti user-enumeration).
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: authService.forgotPassword,
  });
};

/**
 * Mutation per l'applicazione effettiva della nuova password tramite
 * token ricevuto via email (query param ?token= nel link).
 */
export const useResetPassword = () => {
  return useMutation({
    mutationFn: authService.resetPassword,
  });
};

/**
 * Verifica dell'email dopo la registrazione (POST /auth/verify-email).
 * Implementata come query "una tantum" basata sul token nel link.
 */
export const useVerifyEmail = (token) => {
  return useQuery({
    queryKey: ['verifyEmail', token],
    queryFn: () => authService.verifyEmail({ token }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

/**
 * Conferma del cambio email (POST /auth/confirm-email-change). La pagina
 * VerifyEmailChangePage legge il token dalla query string del link email
 * ed esegue questa richiesta esplicita, gestendo successo ed errori
 * direttamente lato client.
 */
export const useConfirmEmailChange = (token) => {
  return useQuery({
    queryKey: ['confirmEmailChange', token],
    queryFn: () => authService.confirmEmailChange({ token }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};