import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsTeacher,
  selectIsAdmin,
} from '../../store/authStore';
import { useLogout } from '../../hooks/useLogout';
import { ROUTES } from '../../constants/routes';
import MessaggiNavLink from '../../features/messaggi/components/MessaggiNavLink';
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
  const isAdmin = useAuthStore(selectIsAdmin);
  const logoutMutation = useLogout();

  const [menuOpen, setMenuOpen] = useState(false);

  // Con il drawer aperto: chiusura con Esc e blocco dello scroll di fondo.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Classi del NavLink con stato attivo (UX + a11y).
  const navLinkClass = ({ isActive }) =>
    [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

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
          <nav
            id="main-nav"
            className={[styles.nav, menuOpen ? styles.navOpen : '']
              .filter(Boolean)
              .join(' ')}
            aria-label={t('nav.mainNavAria')}
            onClick={() => setMenuOpen(false)}
          >
            <button
              type="button"
              className={styles.navClose}
              onClick={() => setMenuOpen(false)}
              aria-label={t('nav.closeMenu', 'Chiudi menu')}
            >
              ×
            </button>
            <NavLink to={ROUTES.DASHBOARD} className={navLinkClass}>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to={ROUTES.QUIZ} className={navLinkClass}>
              {t('nav.quiz')}
            </NavLink>
            {user?.ruolo === 'studente' && (
              <NavLink to={ROUTES.COMPITI_STUDENTE} className={navLinkClass}>
                {t('nav.compitiStudente')}
              </NavLink>
            )}
            {user?.ruolo === 'studente' && (
              <NavLink to={ROUTES.CORSI_STUDENTE} className={navLinkClass}>
                {t('nav.corsiStudente')}
              </NavLink>
            )}
            <NavLink to={ROUTES.PROFILE} className={navLinkClass}>
              {t('nav.profile')}
            </NavLink>
            <MessaggiNavLink className={styles.navLink} />
            {isTeacher && (
              <NavLink to={ROUTES.AULE} className={navLinkClass}>
                {t('nav.aule')}
              </NavLink>
            )}
            {isTeacher && (
              <NavLink to={ROUTES.COMPITI} className={navLinkClass}>
                {t('nav.compiti')}
              </NavLink>
            )}
            {isTeacher && (
              <NavLink to={ROUTES.CORSI} className={navLinkClass}>
                {t('nav.corsi')}
              </NavLink>
            )}
            {isTeacher && (
              <NavLink to={ROUTES.TEACHER_DASHBOARD} className={navLinkClass}>
                {t('nav.statistiche')}
              </NavLink>
            )}
            {isTeacher && (
              <NavLink to={ROUTES.USERS_MANAGEMENT} className={navLinkClass}>
                {t('nav.usersManagement')}
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to={ROUTES.SCUOLE_MANAGEMENT} className={navLinkClass}>
                {t('nav.scuole')}
              </NavLink>
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
            <Link to={ROUTES.LOGIN} className={styles.navLink}>
              {t('nav.login')}
            </Link>
          )}
        </div>

        {isAuthenticated && (
          <button
            type="button"
            className={styles.menuButton}
            aria-label={t('nav.mainNavAria')}
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuIcon} aria-hidden="true" />
          </button>
        )}
      </div>

      {menuOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
};

export default Header;
