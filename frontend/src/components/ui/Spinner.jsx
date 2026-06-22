import { useTranslation } from 'react-i18next';
import styles from './Spinner.module.css';

const Spinner = ({ size = 'md', label }) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading');

  return (
    <div className={styles.wrapper} role="status">
      <span className={[styles.spinner, styles[size]].join(' ')} aria-hidden="true" />
      <span className="visually-hidden">{resolvedLabel}</span>
    </div>
  );
};

export default Spinner;
