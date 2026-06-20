import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Spinner from '../components/ui/Spinner';

/**
 * Guardia inversa: redirige alla dashboard chi è già autenticato e
 * prova ad accedere a pagine come /login o /register. Evita la UX
 * confusa di vedere un form di login mentre si è già loggati.
 */
const PublicOnlyRoute = () => {
  const isAuthChecked = useAuthStore((state) => state.isAuthChecked);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (!isAuthChecked) {
    return <Spinner size="lg" label="Verifica della sessione in corso" />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
