import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './StatusPage.module.css';

const ForbiddenPage = () => {
  return (
    <div className={styles.wrapper}>
      <span className={styles.code} aria-hidden="true">
        403
      </span>
      <h1 className={styles.title}>Accesso negato</h1>
      <p className={styles.text}>
        Non hai i permessi necessari per visualizzare questa pagina.
      </p>
      <Link to={ROUTES.DASHBOARD}>
        <Button>Torna alla dashboard</Button>
      </Link>
    </div>
  );
};

export default ForbiddenPage;
