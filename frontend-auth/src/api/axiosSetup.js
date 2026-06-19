import axios from 'axios';

const baseURL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor per le richieste: aggiunge il Bearer token se presente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor per le risposte: gestisce il refresh token in caso di 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se l'errore è 401 e la richiesta non è già stata ritentata
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('Nessun refresh token');

        // Chiama l'endpoint di refresh (usando axios base per evitare loop infiniti)
        const response = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken
        });

        // Salva il nuovo token
        const newAccessToken = response.data.data.accessToken;
        localStorage.setItem('accessToken', newAccessToken);

        // Aggiorna l'header della richiesta originale e riprova
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Se il refresh fallisce (es. token scaduto o invalidato dal logout)
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login'; // Forza il re-login
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;