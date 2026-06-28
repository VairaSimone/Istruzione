import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsTeacher,
} from '../../store/authStore';
import { useLogout } from '../../hooks/useLogout';
import { ROUTES } from '../../constants/routes';
import Button from '../ui/Button';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import ThemeToggle from '../ui/ThemeToggle';
import toast from 'react-hot-toast';
import styles from './Header.module.css';

const Header = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isTeacher = useAuthStore(selectIsTeacher);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success(t('header.logoutSuccess'));
      navigate(ROUTES.LOGIN);
    } catch {
      navigate(ROUTES.LOGIN);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME}
          className={styles.brand}
        >
          <span className={styles.brandMark} aria-hidden="true">
            日
          </span>
          <span className={styles.brandName}>{import.meta.env.VITE_APP_NAME}</span>
        </Link>

        {isAuthenticated && (
          <nav className={styles.nav} aria-label={t('nav.mainNavAria')}>
            <Link to={ROUTES.DASHBOARD} className={styles.navLink}>
              {t('nav.dashboard')}
            </Link>
            <Link to={ROUTES.QUIZ} className={styles.navLink}>
              {t('nav.quiz')}
            </Link>
            <Link to={ROUTES.PROFILE} className={styles.navLink}>
              {t('nav.profile')}
            </Link>
            {isTeacher && (
              <Link to={ROUTES.USERS_MANAGEMENT} className={styles.navLink}>
                {t('nav.usersManagement')}
              </Link>
            )}
          </nav>
        )}

        <div className={styles.actions}>
          <ThemeToggle />
          <LanguageSwitcher />
          {isAuthenticated ? (
            <>
              <span className={styles.userName}>
                {user?.nome} {user?.cognome}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                isLoading={logoutMutation.isPending}
              >
                {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className={styles.navLink}>
                {t('nav.login')}
              </Link>
  
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
