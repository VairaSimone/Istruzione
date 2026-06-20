
import * as authService from '../services/authService';
import { useMutation, useQuery } from '@tanstack/react-query';
/**
 * Mutation per la richiesta di reset password. Il backend risponde sempre
 * con 200 e messaggio generico, indipendentemente dall'esistenza
 * dell'email (anti user-enumeration) — il frontend non deve quindi
 * mostrare errori specifici tipo "email non trovata".
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
 * Mutation per la verifica dell'email dopo la registrazione.
 * Endpoint: POST /auth/verify-email con { token } nel body — è un POST,
 * quindi (a differenza del cambio email) il frontend DEVE chiamarlo
 * esplicitamente da una pagina dedicata che legge il token dalla query
 * string del link ricevuto via email.
 */
export const useVerifyEmail = (token) => {
  return useQuery({
    queryKey: ['verifyEmail', token],
    // Passiamo il token al service esattamente come faceva mutate({ token })
    queryFn: () => authService.verifyEmail({ token }), 
    // La query parte in automatico solo se c'è un token
    enabled: !!token,
    // Disabilitiamo i retry automatici per non bruciare il token lato backend
    retry: false,
    refetchOnWindowFocus: false,
  });
};