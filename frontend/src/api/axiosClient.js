import axios from 'axios';
import { getActiveLanguage } from '../i18n';
import { getScuolaSlug, HEADER_SCUOLA } from './tenant';

/**
 * Istanza Axios condivisa da tutti i service.
 *
 * Il backend adotta autenticazione basata su cookie httpOnly
 * (access_token, refresh_token). `withCredentials: true` è OBBLIGATORIO:
 * senza questo flag il browser non invierebbe né riceverebbe i cookie
 * cross-origin, anche se CORS è configurato con `credentials: true`.
 *
 * Protezione CSRF (double-submit cookie): per le richieste mutative
 * (POST/PUT/PATCH/DELETE) viene letto il cookie NON httpOnly `csrf_token`
 * e rispedito nell'header `X-CSRF-Token`, che il backend confronta con il
 * cookie.
 *
 * Internazionalizzazione: ad OGNI richiesta viene aggiunto il query param
 * `lang` con la lingua attiva. Il backend (i18next-http-middleware) è
 * configurato con detection order ['querystring','header'] e
 * lookupQuerystring 'lang', quindi userà questa lingua per `req.t`
 * (notifiche/contenuti localizzati lato server). Si usa il query param e
 * NON l'header `Accept-Language` perché quest'ultimo è un "forbidden
 * header" che il browser non consente di impostare via JS.
 *
 * Multi-scuola: quando il tenant attivo è noto (vedi `api/tenant.js`) lo slug
 * viaggia nell'header `X-Scuola`. Serve agli endpoint PUBBLICI di
 * configurazione (`/config`), che devono sapere quale branding servire a un
 * visitatore anonimo. Per le richieste autenticate il backend ignora l'header e
 * usa la scuola dell'utente: l'isolamento tra tenant non dipende dal client.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

const CSRF_SAFE_METHODS = ['get', 'head', 'options'];

const getCookie = (name) => {
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

apiClient.interceptors.request.use((config) => {
  config.params = { ...(config.params || {}), lang: getActiveLanguage() };

  const scuolaSlug = getScuolaSlug();
  if (scuolaSlug) {
    config.headers = config.headers || {};
    config.headers[HEADER_SCUOLA] = scuolaSlug;
  }

  const method = (config.method || 'get').toLowerCase();
  if (!CSRF_SAFE_METHODS.includes(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

export default apiClient;
