import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Spinner from '../components/ui/Spinner';

const ProtectedRoute = ({ allowedRoles }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isAuthChecked = useAuthStore((state) => state.isAuthChecked);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthChecked) {
    return <Spinner size="lg" label={t('session.checking')} />;
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
