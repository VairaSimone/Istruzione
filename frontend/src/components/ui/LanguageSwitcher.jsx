import { useTranslation } from 'react-i18next';
import { useAuthStore, selectIsAuthenticated } from '../../store/authStore';
import { useUpdateLanguage } from '../../hooks/useProfileMutations';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import styles from './LanguageSwitcher.module.css';

/**
 * Selettore di lingua manuale (requisito 5).
 *
 * - Aggiorna immediatamente tutte le traduzioni via i18n.changeLanguage
 *   (la preferenza è persistita su localStorage dal LanguageDetector).
 * - Se l'utente è autenticato, persiste la scelta anche lato backend
 *   (PATCH /me/lingua) così resta valida dopo logout/login.
 */
const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const updateLanguageMutation = useUpdateLanguage();

  const current = SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : i18n.language;

  const handleChange = async (lng) => {
    if (lng === current) return;

    await i18n.changeLanguage(lng);

    if (isAuthenticated) {
      // best-effort: la UI è già aggiornata; in caso di errore la
      // preferenza locale resta comunque persistita su localStorage.
      updateLanguageMutation.mutate({ lingua: lng });
    }
  };

  return (
    <div
      className={styles.switcher}
      role="group"
      aria-label={t('language.aria')}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          className={[styles.option, lng === current ? styles.active : ''].join(' ')}
          aria-pressed={lng === current}
          onClick={() => handleChange(lng)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
