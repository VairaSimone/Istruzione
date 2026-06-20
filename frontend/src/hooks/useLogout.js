import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import { useAuthStore } from '../store/authStore';

/**
 * Mutation di logout. Pulisce sia lo store Zustand che l'intera cache di
 * React Query (tutti i dati protetti, incluse liste utenti per insegnanti,
 * non devono sopravvivere al logout — specie su dispositivi condivisi).
 *
 * NOTA SUL COMPORTAMENTO REALE: il backend incrementa `token_version`
 * lato server, ma `middleware/auth.js` non verifica mai questo valore nei
 * token successivi — quindi l'invalidazione "server-side" delle sessioni
 * attive descritta concettualmente nel backend non ha effetto pratico
 * sugli access token già emessi (restano validi fino a naturale scadenza,
 * max 15 minuti). Il logout client-side, basato sulla cancellazione dei
 * cookie via res.clearCookie, resta comunque l'azione efficace e corretta
 * dal punto di vista dell'utente che lo esegue.
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((state) => state.clearUser);

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      clearUser();
      queryClient.clear();
    },
  });
};
