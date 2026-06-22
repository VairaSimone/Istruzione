import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Spinner from '../components/ui/Spinner';

const PublicOnlyRoute = () => {
  const { t } = useTranslation();
  const isAuthChecked = useAuthStore((state) => state.isAuthChecked);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (!isAuthChecked) {
    return <Spinner size="lg" label={t('session.checking')} />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
