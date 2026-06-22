import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LockoutNotice.module.css';

/**
 * Countdown leggibile quando il login restituisce 403 per lockout.
 * Il backend non restituisce un timestamp di sblocco esatto: solo un
 * messaggio testuale con i minuti rimanenti. Il countdown è quindi
 * approssimato lato client a partire dai minuti estratti dal messaggio
 * GREZZO del backend (le sole cifre, indipendenti dalla lingua) e serve
 * solo come indicazione visiva — il backend resta l'unico arbitro reale.
 *
 * Tutta la parte testuale (titolo, countdown) è localizzata.
 */
const LockoutNotice = ({ message }) => {
  const { t } = useTranslation();

  // Estrae i minuti dal messaggio del backend, se presenti (es. "15 min...")
  const match = message?.match(/(\d+)\s*min/i);
  const initialMinutes = match ? parseInt(match[1], 10) : null;

  const [secondsLeft, setSecondsLeft] = useState(
    initialMinutes ? initialMinutes * 60 : null
  );

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  if (secondsLeft === null) {
    return (
      <div className={styles.banner} role="alert">
        <p className={styles.text}>{t('lockout.title')}</p>
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className={styles.banner} role="alert">
      <p className={styles.text}>{t('lockout.title')}</p>
      {secondsLeft > 0 ? (
        <p className={styles.countdown}>
          {t('lockout.retryIn')}{' '}
          <strong>
            {minutes}:{String(seconds).padStart(2, '0')}
          </strong>
        </p>
      ) : (
        <p className={styles.countdown}>{t('lockout.retryNow')}</p>
      )}
    </div>
  );
};

export default LockoutNotice;
