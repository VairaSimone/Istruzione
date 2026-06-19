import { createContext, useState, useEffect } from 'react';
import api from '../api/axiosSetup';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.data.utente);
        } catch (error) {
          console.error("Sessione scaduta o non valida");
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, utente } = response.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(utente);
  };

  const register = async (userData) => {
    await api.post('/auth/register', userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error("Errore durante il logout dal server");
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  // --- NUOVE FUNZIONI INTEGRATE ---
  
  const forgotPassword = async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data; // Utile se in sviluppo restituisce il _debug_token
  };

  const resetPassword = async (token, nuovaPassword) => {
    await api.post('/auth/reset-password', { token, nuovaPassword });
  };

  const changeEmail = async (nuovaEmail) => {
    const response = await api.patch('/auth/change-email', { nuovaEmail });
    setUser(response.data.data.utente); // Aggiorna l'utente in tempo reale nel frontend
  };

  if (loading) return <div>Caricamento in corso...</div>;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, forgotPassword, resetPassword, changeEmail }}>
      {children}
    </AuthContext.Provider>
  );
};