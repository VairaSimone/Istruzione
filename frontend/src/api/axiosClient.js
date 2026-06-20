import axios from 'axios';

/**
 * Istanza Axios condivisa da tutti i service.
 *
 * Il backend adotta autenticazione basata su cookie httpOnly
 * (access_token, refresh_token) — vedi documentazione modulo Auth, sezione 3.
 * `withCredentials: true` è OBBLIGATORIO: senza questo flag il browser non
 * invierebbe né riceverebbe i cookie cross-origin, anche se CORS è configurato
 * correttamente sul backend con `credentials: true`.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
