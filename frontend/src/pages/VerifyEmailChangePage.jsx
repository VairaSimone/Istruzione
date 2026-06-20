import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import styles from './AuthPage.module.css';


const VerifyEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const reason = searchParams.get('reason');

  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Mappa delle ragioni di errore fornite dal backend
  const getErrorMessage = () => {
    switch (reason) {
      case 'missing_token':
        return "Il link non contiene alcun token di sicurezza.";
      case 'expired_token':
        return "Il link di conferma è scaduto. Torna nel tuo profilo e richiedi un nuovo cambio email.";
      case 'invalid_token':
        return "Il token non è valido o è già stato utilizzato.";
      default:
        return "Si è verificato un errore sconosciuto durante la conferma della nuova email.";
    }
  };

  if (isError) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>Modifica fallita</h1>
            <p className={styles.successText}>{getErrorMessage()}</p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth variant="secondary">Torna al Profilo</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Se non è success (e non è error), caso anomalo (es. l'utente ha scritto l'url a mano)
  if (!isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <h1 className={styles.title}>Stato non determinato</h1>
            <p className={styles.successText}>
              Impossibile determinare l'esito dell'operazione. Usa l'apposita sezione nel tuo profilo per gestire le tue email.
            </p>
            <Link to={ROUTES.PROFILE}>
              <Button fullWidth>Vai al Profilo</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Caso di Successo
  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.successBox}>
          <div className={styles.successIcon} aria-hidden="true">
            済
          </div>
          <h1 className={styles.title}>Email aggiornata!</h1>
          <p className={styles.successText}>
            Il tuo nuovo indirizzo email è stato confermato con successo. Potrai usarlo per accedere da ora in poi.
          </p>
          <Link to={ROUTES.PROFILE}>
            <Button fullWidth>Vai al Profilo</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailChangePage;