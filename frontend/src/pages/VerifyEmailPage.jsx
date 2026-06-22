import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVerifyEmail } from '../hooks/usePasswordAndEmailFlows';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import styles from './AuthPage.module.css';

const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isSuccess, isError, error } = useVerifyEmail(token);

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>{t('auth.verifyEmail.failTitle')}</h1>
            <p className={styles.successText}>{t('auth.verifyEmail.failNoToken')}</p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                {t('auth.verifyEmail.backToLogin')}
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
            <h1 className={styles.title}>{t('auth.verifyEmail.successTitle')}</h1>
            <p className={styles.successText}>{t('auth.verifyEmail.successText')}</p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth>{t('auth.verifyEmail.successCta')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>{t('auth.verifyEmail.failTitle')}</h1>
            <p className={styles.successText}>
              {getApiErrorMessage(t, error) || t('auth.verifyEmail.failGeneric')}
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                {t('auth.verifyEmail.backToLogin')}
              </Button>
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
          <Spinner label={t('auth.verifyEmail.pendingAria')} />
          <p className={styles.successText}>{t('auth.verifyEmail.pending')}</p>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
