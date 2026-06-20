import { useEffect, useState } from 'react';
import styles from './LockoutNotice.module.css';

/**
 * Mostra un countdown leggibile quando il login restituisce 403 per
 * lockout (5 tentativi falliti -> blocco 15 minuti, vedi
 * authService.loginUtente). Il backend non restituisce un timestamp di
 * sblocco esatto nel body — solo un messaggio testuale con i minuti
 * rimanenti (es. "Riprova tra 12 minuti") — quindi il countdown è
 * approssimato lato client a partire da quel messaggio iniziale e serve
 * solo come indicazione visiva, non come fonte di verità: il backend
 * resta l'unico arbitro reale dello sblocco.
 */
const LockoutNotice = ({ message }) => {
  // Estrae il numero di minuti dal messaggio del backend, se presente
  const match = message?.match(/(\d+)\s*minut/i);
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
        {message}
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className={styles.banner} role="alert">
      <p className={styles.text}>
        Account temporaneamente bloccato per troppi tentativi.
      </p>
      {secondsLeft > 0 ? (
        <p className={styles.countdown}>
          Riprova tra{' '}
          <strong>
            {minutes}:{String(seconds).padStart(2, '0')}
          </strong>
        </p>
      ) : (
        <p className={styles.countdown}>Puoi riprovare ora.</p>
      )}
    </div>
  );
};

export default LockoutNotice;
