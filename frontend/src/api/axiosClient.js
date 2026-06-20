import axios from 'axios';

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
 * cookie. Un attaccante cross-site non può leggere il cookie né impostare
 * l'header personalizzato.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const CSRF_SAFE_METHODS = ['get', 'head', 'options'];

const getCookie = (name) => {
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

apiClient.interceptors.request.use((config) => {
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