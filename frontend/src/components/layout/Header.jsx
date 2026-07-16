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
import { useBranding, useFunzionalita } from '../../hooks/useConfig';
import { ROUTES } from '../../constants/routes';
import { FUNZIONALITA } from '../../constants/funzionalita';
import MessaggiNavLink from '../../features/messaggi/components/MessaggiNavLink';
import Button from '../ui/Button';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import ThemeToggle from '../ui/ThemeToggle';
import BrandLogo from '../branding/BrandLogo';
import ScuolaSwitcher from '../branding/ScuolaSwitcher';
import toast from 'react-hot-toast';
import styles from './Header.module.css';

/**
 * Intestazione dell'applicazione.
 *
 * Il MENU non è più una lista fissa: ogni voce dichiara la sezione da cui
 * dipende, e viene mostrata solo se la scuola l'ha attivata. L'admin è
 * trasversale alle scuole e vede tutto, come nel backend.
 *
 * Anche il MARCHIO è della scuola, non della materia: logo caricato o
 * monogramma generato dalle iniziali.
 */
const Header = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isTeacher = useAuthStore(selectIsTeacher);
  const isAdmin = useAuthStore(selectIsAdmin);
  const logoutMutation = useLogout();

  const branding = useBranding();
  const funzionalita = useFunzionalita();

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

  /** L'admin ignora i gate di sezione: non appartiene ad alcuna scuola. */
  const sezioneAttiva = (chiave) => isAdmin || funzionalita[chiave] !== false;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success(t('header.logoutSuccess'));
      navigate(ROUTES.LOGIN);
    } catch {
      navigate(ROUTES.LOGIN);
    }
  };

  const isStudente = user?.ruolo === 'studente';
  const mostraTemaToggle = branding.aspetto?.temaSelezionabile !== false;
  // La scuola può nascondere il nome accanto al logo (logo già "parlante").
  const mostraNome = branding.aspetto?.mostraNomeAccantoLogo !== false;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME}
          className={styles.brand}
        >
          <BrandLogo className={styles.brandMark} />
          {mostraNome && (
            <span className={styles.brandName}>{branding.nomeBreve || branding.nome}</span>
          )}
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
              aria-label={t('nav.closeMenu')}
            >
              ×
            </button>

            <NavLink to={ROUTES.DASHBOARD} className={navLinkClass}>
              {t('nav.dashboard')}
            </NavLink>

            {sezioneAttiva(FUNZIONALITA.QUIZ) && (
              <NavLink to={ROUTES.QUIZ} className={navLinkClass}>
                {t('nav.quiz')}
              </NavLink>
            )}

            {isStudente && sezioneAttiva(FUNZIONALITA.COMPITI) && (
              <NavLink to={ROUTES.COMPITI_STUDENTE} className={navLinkClass}>
                {t('nav.compitiStudente')}
              </NavLink>
            )}

            {isStudente && sezioneAttiva(FUNZIONALITA.CORSI) && (
              <NavLink to={ROUTES.CORSI_STUDENTE} className={navLinkClass}>
                {t('nav.corsiStudente')}
              </NavLink>
            )}

            {isStudente && sezioneAttiva(FUNZIONALITA.PAGAMENTI) && (
              <NavLink to={ROUTES.CATALOGO} className={navLinkClass}>
                {t('nav.catalogo')}
              </NavLink>
            )}

            {isStudente && sezioneAttiva(FUNZIONALITA.CERTIFICAZIONI) && (
              <NavLink to={ROUTES.CERTIFICATI_STUDENTE} className={navLinkClass}>
                {t('nav.certificatiStudente')}
              </NavLink>
            )}

            <NavLink to={ROUTES.PROFILE} className={navLinkClass}>
              {t('nav.profile')}
            </NavLink>

            {sezioneAttiva(FUNZIONALITA.MESSAGGI) && (
              <MessaggiNavLink className={styles.navLink} />
            )}

            {sezioneAttiva(FUNZIONALITA.CALENDARIO) && (
              <NavLink to={ROUTES.CALENDARIO} className={navLinkClass}>
                {t('nav.calendario')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.AULE) && (
              <NavLink to={ROUTES.AULE} className={navLinkClass}>
                {t('nav.aule')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.COMPITI) && (
              <NavLink to={ROUTES.COMPITI} className={navLinkClass}>
                {t('nav.compiti')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.CORSI) && (
              <NavLink to={ROUTES.CORSI} className={navLinkClass}>
                {t('nav.corsi')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.PAGAMENTI) && (
              <NavLink to={ROUTES.SCUOLA_PAGAMENTI} className={navLinkClass}>
                {t('nav.pagamenti')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.QUIZ) && (
              <NavLink to={ROUTES.QUIZ_GESTIONE} className={navLinkClass}>
                {t('nav.quizGestione')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.CERTIFICAZIONI) && (
              <NavLink to={ROUTES.CERTIFICATI} className={navLinkClass}>
                {t('nav.certificati')}
              </NavLink>
            )}

            {isTeacher && sezioneAttiva(FUNZIONALITA.STATISTICHE) && (
              <NavLink to={ROUTES.TEACHER_DASHBOARD} className={navLinkClass}>
                {t('nav.statistiche')}
              </NavLink>
            )}

            {(isTeacher || isAdmin) && (
              <NavLink to={ROUTES.USERS_MANAGEMENT} className={navLinkClass}>
                {t('nav.usersManagement')}
              </NavLink>
            )}

            {/* Richieste dal form della homepage pubblica (lead). */}
            {(isTeacher || isAdmin) && (
              <NavLink to={ROUTES.CONTATTI_MANAGEMENT} className={navLinkClass}>
                {t('nav.contatti')}
              </NavLink>
            )}

            {/* Configurazione della propria scuola: riservata a chi ne ha una. */}
            {isTeacher && (
              <NavLink to={ROUTES.IMPOSTAZIONI_SCUOLA} className={navLinkClass}>
                {t('nav.impostazioniScuola')}
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
          {!isAuthenticated && <ScuolaSwitcher />}
          {mostraTemaToggle && <ThemeToggle />}
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
