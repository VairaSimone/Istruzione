import { QueryClient } from '@tanstack/react-query';
import { parseApiError } from '../utils/parseApiError';

/**
 * Configurazione di default per tutte le query/mutation dell'app.
 *
 * `retry`: per le query, ritenta automaticamente 1 volta su errori di
 * rete/server (5xx) o senza risposta, ma MAI su errori 4xx (sono errori
 * "previsti" lato client: validazione, non trovato, non autorizzato —
 * ritentare non cambierebbe l'esito e rallenterebbe solo la UI). Le
 * mutation non vengono mai ritentate automaticamente: un retry silenzioso
 * su un POST/PATCH/DELETE potrebbe causare effetti collaterali duplicati
 * (es. doppia registrazione, doppia eliminazione).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const { statusCode } = parseApiError(error);
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});
