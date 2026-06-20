import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Spinner from '../components/ui/Spinner';

/**
 * Guardia di route per autenticazione e, opzionalmente, ruolo.
 *
 * `isAuthChecked` (dallo store) distingue tre stati:
 *  - non ancora verificato (boot dell'app, GET /me in corso) -> mostra spinner
 *  - verificato e NON autenticato -> redirect a /login con `state.from`
 *    per poter tornare alla pagina richiesta dopo il login
 *  - verificato e autenticato -> renderizza le route figlie (Outlet)
 *
 * `allowedRoles`, se fornito, applica un controllo di autorizzazione
 * aggiuntivo (es. solo 'insegnante' per /gestione/utenti). Il controllo
 * server-side resta comunque l'unica fonte di verità reale: questo è solo
 * un controllo di UX per evitare di mostrare schermate che il backend
 * rifiuterebbe con 403.
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const location = useLocation();
  const isAuthChecked = useAuthStore((state) => state.isAuthChecked);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthChecked) {
    return <Spinner size="lg" label="Verifica della sessione in corso" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.ruolo)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
