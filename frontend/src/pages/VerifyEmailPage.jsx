import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmail } from '../hooks/usePasswordAndEmailFlows';
import { parseApiError } from '../utils/parseApiError';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import styles from './AuthPage.module.css';

/**
 * Pagina raggiunta dal link nell'email di verifica registrazione:
 * /verify-email?token=<hex64>
 *
 * NOTA SU REACT STRICTMODE + CALLBACK DI MUTATE(): le callback
 * onSuccess/onError passate direttamente a mutate(variables, { onSuccess,
 * onError }) sono legate al componente chiamante. Se StrictMode smonta
 * quel componente prima che la risposta arrivi, le callback possono non
 * essere mai invocate — anche se la mutation stessa completa con
 * successo (visibile nei devtools). Per questo NON ci affidiamo a
 * onSuccess/onError, ma leggiamo direttamente lo stato della mutation
 * (isSuccess/isError/data/error), che è mantenuto nella cache di
 * TanStack Query e sopravvive ai remount.
 *
 * Il guard a livello di MODULO (tokenGiaInviati) serve solo a evitare di
 * chiamare mutate() due volte per lo stesso token durante il doppio mount
 * di StrictMode — non per propagare il risultato (che ora arriva dallo
 * stato della mutation, non da una callback).
 */

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
const { isSuccess, isError, error } = useVerifyEmail(token);

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>Verifica non riuscita</h1>
            <p className={styles.successText}>Il link non contiene un token valido.</p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                Torna al login
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
            <h1 className={styles.title}>Email verificata!</h1>
            <p className={styles.successText}>
              Il tuo account è ora attivo. Puoi effettuare il login.
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth>Vai al login</Button>
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
            <h1 className={styles.title}>Verifica non riuscita</h1>
            <p className={styles.successText}>
{parseApiError(error).message ||
  'Il link di verifica non è valido o è scaduto. Prova a registrarti di nuovo o contatta il supporto.'}            </p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                Torna al login
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
          <Spinner label="Verifica email in corso" />
          <p className={styles.successText}>Verifica della tua email in corso…</p>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;