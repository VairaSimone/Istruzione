import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as authService from '../services/authService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/authStore';

/**
 * Recupera l'utente corrente da GET /auth/me e lo sincronizza con lo
 * store Zustand. Va usato una volta al boot dell'app (in App.jsx) per
 * ricostruire la sessione a partire dal cookie httpOnly esistente, dato
 * che il login non restituisce i dati utente (vedi authController.login,
 * che risponde solo con { status, message }).
 */
export const useCurrentUser = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const query = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const data = await authService.getMe();
      return data.data.utente;
    },
    retry: false, // un 401 qui è un caso atteso ("non loggato"), non va ritentato
    staleTime: 5 * 60 * 1000, // 5 minuti: i dati profilo cambiano raramente
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isSuccess) {
      setUser(query.data);
    } else if (query.isError) {
      clearUser();
    }
  }, [query.isSuccess, query.isError, query.data, setUser, clearUser]);

  return query;
};
