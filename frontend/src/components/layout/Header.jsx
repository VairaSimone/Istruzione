import { Link, useNavigate } from 'react-router-dom';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsTeacher,
} from '../../store/authStore';
import { useLogout } from '../../hooks/useLogout';
import { ROUTES } from '../../constants/routes';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import styles from './Header.module.css';

const Header = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isTeacher = useAuthStore(selectIsTeacher);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success('Logout effettuato con successo.');
      navigate(ROUTES.LOGIN);
    } catch {
      // Anche in caso di errore di rete, lo stato locale viene pulito
      // (onSettled in useLogout) — l'utente viene comunque disconnesso
      // lato client per sicurezza.
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
          <nav className={styles.nav} aria-label="Navigazione principale">
            <Link to={ROUTES.DASHBOARD} className={styles.navLink}>
              Dashboard
            </Link>
            <Link to={ROUTES.PROFILE} className={styles.navLink}>
              Profilo
            </Link>
            {isTeacher && (
              <Link to={ROUTES.USERS_MANAGEMENT} className={styles.navLink}>
                Gestione utenti
              </Link>
            )}
          </nav>
        )}

        <div className={styles.actions}>
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
                Esci
              </Button>
            </>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className={styles.navLink}>
                Accedi
              </Link>
              <Button size="sm" onClick={() => navigate(ROUTES.REGISTER)}>
                Registrati
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
