import { useMutation } from '@tanstack/react-query';
import * as authService from '../services/authService';

/**
 * Mutation di registrazione. Non logga automaticamente l'utente: il
 * backend crea l'account con email_verificata=false e invia un'email di
 * verifica — l'utente deve verificare l'email prima di poter fare login
 * (vedi authService.loginUtente, che blocca il login se !email_verificata).
 */
export const useRegister = () => {
  return useMutation({
    mutationFn: authService.register,
  });
};
