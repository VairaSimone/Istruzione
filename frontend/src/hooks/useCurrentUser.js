import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as authService from '../services/authService';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/authStore';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

/**
 * Recupera l'utente corrente da GET /auth/me e lo sincronizza con lo
 * store Zustand. Va usato una volta al boot dell'app (in App.jsx) per
 * ricostruire la sessione a partire dal cookie httpOnly esistente.
 *
 * Sincronizzazione lingua (requisito): la lingua salvata nel profilo
 * backend ha PRIORITÀ su quella rilevata dal browser. Quando /me ritorna
 * una `lingua` valida e diversa da quella attiva, aggiorniamo l'intera
 * interfaccia senza refresh tramite i18n.changeLanguage (che persiste
 * anche su localStorage).
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isSuccess) {
      const utente = query.data;
      setUser(utente);

      if (
        utente?.lingua &&
        SUPPORTED_LANGUAGES.includes(utente.lingua) &&
        utente.lingua !== i18n.resolvedLanguage
      ) {
        i18n.changeLanguage(utente.lingua);
      }
    } else if (query.isError) {
      clearUser();
    }
  }, [query.isSuccess, query.isError, query.data, setUser, clearUser]);

  return query;
};
