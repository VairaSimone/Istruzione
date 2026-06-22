import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './StatusPage.module.css';

const NotFoundPage = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper}>
      <span className={styles.code} aria-hidden="true">
        404
      </span>
      <h1 className={styles.title}>{t('status.notFoundTitle')}</h1>
      <p className={styles.text}>{t('status.notFoundText')}</p>
      <Link to={ROUTES.HOME}>
        <Button>{t('status.notFoundCta')}</Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
