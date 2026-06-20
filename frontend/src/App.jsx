import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './api/queryClient';
import { router } from './routes/router';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useCurrentUser } from './hooks/useCurrentUser';

/**
 * Esegue il bootstrap della sessione: chiama GET /me una sola volta
 * all'avvio dell'app per ricostruire lo stato di autenticazione a partire
 * dal cookie httpOnly esistente (se presente). Va montato DENTRO
 * QueryClientProvider, motivo per cui vive in un componente figlio
 * separato da App invece che in App stesso.
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
      <SessionBootstrap />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            borderRadius: '6px',
          },
          success: {
            iconTheme: { primary: '#3d5a4c', secondary: '#fdfcf9' },
          },
          error: {
            iconTheme: { primary: '#c9402a', secondary: '#fdfcf9' },
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
