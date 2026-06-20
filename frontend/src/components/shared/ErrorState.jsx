import Button from '../ui/Button';
import styles from './ErrorState.module.css';

/**
 * Stato di errore per query React Query fallite (es. errore di rete nel
 * caricamento della lista utenti). Sempre con possibilità di riprovare,
 * mai uno schermo bloccato senza via d'uscita.
 */
const ErrorState = ({ message, onRetry }) => {
  return (
    <div className={styles.wrapper} role="alert">
      <p className={styles.message}>
        {message || 'Non è stato possibile caricare i dati. Riprova.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
