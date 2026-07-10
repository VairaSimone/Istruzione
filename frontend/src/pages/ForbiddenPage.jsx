import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './StatusPage.module.css';

/**
 * Pagina 403. Distingue due situazioni molto diverse per l'utente:
 *
 *   - NON HAI I PERMESSI  → l'utente ha sbagliato pagina (rotta riservata allo
 *     staff, ad esempio). Il messaggio è quello classico.
 *   - SEZIONE DISATTIVATA → la scuola ha spento quella sezione. Non è colpa
 *     dell'utente e non c'è nulla che possa fare: glielo diciamo chiaramente,
 *     invece di lasciargli credere di aver perso un privilegio.
 *
 * `FeatureRoute` passa la chiave della sezione nello state della navigazione.
 */
const ForbiddenPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const funzionalita = location.state?.funzionalita ?? null;

  const titolo = funzionalita
    ? t('status.featureDisabledTitle')
    : t('status.forbiddenTitle');

  const testo = funzionalita
    ? t('status.featureDisabledText', {
        sezione: t(`funzionalita.${funzionalita}.nome`, { defaultValue: funzionalita }),
      })
    : t('status.forbiddenText');

  return (
    <div className={styles.wrapper}>
      <span className={styles.code} aria-hidden="true">
        403
      </span>
      <h1 className={styles.title}>{titolo}</h1>
      <p className={styles.text}>{testo}</p>
      <Link to={ROUTES.DASHBOARD}>
        <Button>{t('status.forbiddenCta')}</Button>
      </Link>
    </div>
  );
};

export default ForbiddenPage;
