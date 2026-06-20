import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import styles from './AuthPage.module.css';

/**
 * Pagina raggiunta dopo che il backend ha gestito
 * GET /auth/confirm-email-change?token=...
 *
 * LIMITE NOTO DEL BACKEND (non aggirabile dal frontend): il controller
 * `confirmEmailChange` esegue un redirect 302 verso questa pagina SOLO in
 * caso di successo (?status=success). Se il token è mancante, invalido o
 * scaduto, il backend risponde direttamente con JSON grezzo (400 o errore
 * gestito da errorHandler), e il browser — avendo seguito il link email,
 * non una chiamata fetch del frontend — mostrerà quella risposta JSON
 * invece di questa pagina React. Non esiste un modo lato client per
 * intercettare questo caso, perché la richiesta non passa mai per il
 * nostro Router: il backend dovrebbe redirigere anche in caso di errore
 * (es. /verify-email-change?status=error&reason=...) per permettere al
 * frontend di gestire elegantemente anche il caso negativo.
 *
 * Questa pagina gestisce quindi solo il percorso di successo: se l'utente
 * vi arriva senza status=success (caso anomalo, es. navigazione diretta),
 * mostriamo un messaggio neutro invece di assumere un fallimento che non
 * abbiamo realmente verificato.
 */
const VerifyEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');

  const isConfirmedSuccess = status === 'success';

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.successBox}>
          <div
            className={styles.successIcon}
            style={!isConfirmedSuccess ? { color: 'var(--color-text-muted)' } : undefined}
            aria-hidden="true"
          >
            {isConfirmedSuccess ? '済' : '?'}
          </div>
          <h1 className={styles.title}>
            {isConfirmedSuccess ? 'Email aggiornata!' : 'Stato non determinato'}
          </h1>
          <p className={styles.successText}>
            {isConfirmedSuccess
              ? 'Il tuo nuovo indirizzo email è stato confermato con successo. Potrai usarlo per accedere da ora in poi.'
              : "Non è stato possibile confermare l'esito di questa operazione da questa pagina. Se hai cliccato un link scaduto o non valido, prova a richiedere nuovamente il cambio email dal tuo profilo."}
          </p>
          <Link to={ROUTES.PROFILE}>
            <Button fullWidth>Vai al profilo</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmailChangePage;
