import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import styles from './ErrorState.module.css';

/**
 * Stato di errore per query React Query fallite. Sempre con possibilità di
 * riprovare, mai uno schermo bloccato senza via d'uscita.
 */
const ErrorState = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper} role="alert">
      <p className={styles.message}>{message || t('errors.loadFailed')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
