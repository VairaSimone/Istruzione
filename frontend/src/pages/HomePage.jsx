import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './HomePage.module.css';

const HomePage = () => {
  return (
    <div className={styles.hero}>
      <span className={styles.eyebrow} aria-hidden="true">
        日本語
      </span>
      <h1 className={styles.title}>{import.meta.env.VITE_APP_NAME}</h1>
      <p className={styles.subtitle}>
        La piattaforma per studenti e insegnanti per seguire il percorso di apprendimento
        della lingua giapponese, classe per classe.
      </p>
      <div className={styles.actions}>
        <Link to={ROUTES.REGISTER}>
          <Button size="lg">Inizia ora</Button>
        </Link>
        <Link to={ROUTES.LOGIN}>
          <Button size="lg" variant="secondary">
            Ho già un account
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;
