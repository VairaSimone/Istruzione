import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './HomePage.module.css';

const HomePage = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.hero}>
      <span className={styles.eyebrow} aria-hidden="true">
        日本語
      </span>
      <h1 className={styles.title}>{import.meta.env.VITE_APP_NAME}</h1>
      <p className={styles.subtitle}>{t('home.subtitle')}</p>
      <div className={styles.actions}>
        <Link to={ROUTES.LOGIN}>
          <Button size="lg">{t('home.login')}</Button>
        </Link>
      </div>
      <p className={styles.note}>{t('home.studentInviteNote')}</p>
    </div>
  );
};

export default HomePage;
