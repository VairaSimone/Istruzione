import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/authStore';

/**
 * Mutation di login. Dato che POST /auth/login NON restituisce i dati
 * utente (solo { status, message } — i cookie vengono impostati via
 * Set-Cookie), dopo il login riuscito invalidiamo la query 'me' per
 * forzare un GET /auth/me fresco e popolare lo store con i dati reali.
 */
export const useLogin = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: authService.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      const fresh = await queryClient.fetchQuery({
        queryKey: queryKeys.auth.me,
        queryFn: async () => {
          const data = await authService.getMe();
          return data.data.utente;
        },
      });
      setUser(fresh);
    },
  });
};
