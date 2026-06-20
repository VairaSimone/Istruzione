import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './StatusPage.module.css';

const NotFoundPage = () => {
  return (
    <div className={styles.wrapper}>
      <span className={styles.code} aria-hidden="true">
        404
      </span>
      <h1 className={styles.title}>Pagina non trovata</h1>
      <p className={styles.text}>
        La pagina che stai cercando non esiste o è stata spostata.
      </p>
      <Link to={ROUTES.HOME}>
        <Button>Torna alla home</Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
