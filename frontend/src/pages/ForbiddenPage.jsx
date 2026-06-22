import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import styles from './StatusPage.module.css';

const ForbiddenPage = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper}>
      <span className={styles.code} aria-hidden="true">
        403
      </span>
      <h1 className={styles.title}>{t('status.forbiddenTitle')}</h1>
      <p className={styles.text}>{t('status.forbiddenText')}</p>
      <Link to={ROUTES.DASHBOARD}>
        <Button>{t('status.forbiddenCta')}</Button>
      </Link>
    </div>
  );
};

export default ForbiddenPage;
