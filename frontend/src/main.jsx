import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // inizializza l'i18n (sincrono) PRIMA del primo render
import App from './App.jsx';
import './assets/styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
