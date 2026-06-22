import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirmEmailChange } from '../hooks/usePasswordAndEmailFlows';
import { parseApiError } from '../utils/parseApiError';
import { API_ERROR_CODES } from '../constants/domain';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import styles from './AuthPage.module.css';

/**
 * Pagina raggiunta dal link nell'email di cambio indirizzo:
 * /verify-email-change?token=<hex64>
 *
 * Esegue una richiesta POST esplicita di conferma (non più una GET del
 * backend che modifica lo stato), così l'esito — successo o errore — è
 * sempre gestito lato client.
 */
const VerifyEmailChangePage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isSuccess, isError, error } = useConfirmEmailChange(token);

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>{t('auth.verifyEmailChange.invalidTitle')}</h1>
            <p className={styles.successText}>
              {t('auth.verifyEmailChange.invalidText')}
            </p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth variant="secondary">
                {t('auth.verifyEmailChange.backToProfile')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    const parsed = parseApiError(error);
    const message =
      parsed.code === API_ERROR_CODES.EXPIRED_TOKEN
        ? t('auth.verifyEmailChange.failExpired')
        : parsed.code === API_ERROR_CODES.EMAIL_TAKEN
          ? t('auth.verifyEmailChange.failEmailTaken')
          : t('auth.verifyEmailChange.failGeneric');

    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>{t('auth.verifyEmailChange.failTitle')}</h1>
            <p className={styles.successText}>{message}</p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth variant="secondary">
                {t('auth.verifyEmailChange.backToProfile')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon} aria-hidden="true">
              済
            </div>
            <h1 className={styles.title}>{t('auth.verifyEmailChange.successTitle')}</h1>
            <p className={styles.successText}>
              {t('auth.verifyEmailChange.successText')}
            </p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth>{t('auth.verifyEmailChange.successCta')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.successBox}>
          <Spinner label={t('auth.verifyEmailChange.pendingAria')} />
          <p className={styles.successText}>{t('auth.verifyEmailChange.pending')}</p>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailChangePage;
