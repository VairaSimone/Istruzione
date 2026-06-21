import apiClient from './axiosClient';
import { useAuthStore } from '../store/authStore';
import { API_ERROR_CODES } from '../constants/domain';
import { ROUTES } from '../constants/routes';

/**
 * Interceptor di risposta per la gestione automatica della scadenza
 * dell'access token, secondo il flusso descritto nella documentazione
 * (sezione 3, "Gestione degli Errori e Scadenza Sessione"):
 *
 *  1. Una richiesta fallisce con 401 e code TOKEN_EXPIRED.
 *  2. Si chiama POST /refresh-token (il cookie refresh_token viaggia
 *     automaticamente, essendo httpOnly — nessun body necessario).
 *  3. Se il refresh ha successo, si ritenta la richiesta originale UNA
 *     sola volta.
 *  4. Se anche il refresh fallisce, l'utente viene disconnesso e
 *     reindirizzato al login.
 *
 * Le richieste multiple in parallelo che falliscono simultaneamente per
 * token scaduto condividono la STESSA promise di refresh, per evitare
 * race condition con N chiamate concorrenti a /refresh-token.
 */

let refreshPromise = null;

const isAuthEndpoint = (url = '') =>
  url.includes('/auth/login') ||
  url.includes('/auth/refresh-token') ||
  url.includes('/auth/register');

const redirectToLogin = () => {
  useAuthStore.getState().clearUser();
  if (window.location.pathname !== ROUTES.LOGIN) {
    window.location.assign(ROUTES.LOGIN);
  }
};

export const setupAuthInterceptor = () => {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config, response } = error;

      if (!response || !config) {
        return Promise.reject(error);
      }

      const errorCode = response.data?.code;
      const isTokenExpired =
        response.status === 401 && errorCode === API_ERROR_CODES.TOKEN_EXPIRED;

      if (!isTokenExpired || isAuthEndpoint(config.url) || config._retry) {
        if (
          response.status === 401 &&
          (errorCode === API_ERROR_CODES.REFRESH_TOKEN_EXPIRED ||
            errorCode === API_ERROR_CODES.INVALID_REFRESH_TOKEN ||
            errorCode === API_ERROR_CODES.NO_REFRESH_TOKEN)
        ) {
          redirectToLogin();
        }
        return Promise.reject(error);
      }

      config._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = apiClient.post('/auth/refresh-token').finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return apiClient(config);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
  );
};
