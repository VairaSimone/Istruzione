import { Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isSuccess, isError, error } = useConfirmEmailChange(token);

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>Link non valido</h1>
            <p className={styles.successText}>
              Il link non contiene alcun token di sicurezza. Torna nel tuo profilo e
              richiedi un nuovo cambio email.
            </p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth variant="secondary">
                Torna al Profilo
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
        ? 'Il link di conferma è scaduto. Torna nel tuo profilo e richiedi un nuovo cambio email.'
        : parsed.code === API_ERROR_CODES.EMAIL_TAKEN
          ? 'Questo indirizzo email è ora associato a un altro account.'
          : parsed.message ||
            'Il token non è valido o è già stato utilizzato. Richiedi un nuovo cambio email dal tuo profilo.';

    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>Modifica fallita</h1>
            <p className={styles.successText}>{message}</p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth variant="secondary">
                Torna al Profilo
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
            <h1 className={styles.title}>Email aggiornata!</h1>
            <p className={styles.successText}>
              Il tuo nuovo indirizzo email è stato confermato con successo. Potrai usarlo
              per accedere da ora in poi.
            </p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth>Vai al Profilo</Button>
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
          <Spinner label="Conferma del cambio email in corso" />
          <p className={styles.successText}>Conferma del nuovo indirizzo email in corso…</p>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailChangePage;