import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './api/queryClient';
import { router } from './routes/router';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useCurrentUser } from './hooks/useCurrentUser';
import BrandingProvider from './components/branding/BrandingProvider';

/**
 * Ricostruisce la sessione (GET /me) al boot. Vive fuori dal router perché non
 * deve dipendere dalla rotta corrente.
 */
const SessionBootstrap = () => {
  useCurrentUser();
  return null;
};

const App = () => {
  useEffect(() => {
    setupAuthInterceptor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        Il branding si carica in parallelo alla sessione, non dopo: `GET /config`
        è pubblico, e il nome e i colori della scuola devono essere sullo schermo
        già alla pagina di login, non solo dopo l'autenticazione.
      */}
      <BrandingProvider />
      <SessionBootstrap />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            borderRadius: '6px',
            // Token del tema attivo: i toast seguono Chiaro/Scuro e il brand
            // della scuola, perché i token sono sovrascritti su <html>.
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-elevated)',
          },
          success: {
            iconTheme: { primary: 'var(--color-matcha)', secondary: 'var(--color-paper)' },
          },
          error: {
            iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-paper)' },
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
