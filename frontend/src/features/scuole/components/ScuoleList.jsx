import { useTranslation } from 'react-i18next';
import ScuolaRow from './ScuolaRow';
import Skeleton from '../../../components/shared/Skeleton';
import EmptyState from '../../../components/shared/EmptyState';
import ErrorState from '../../../components/shared/ErrorState';
import styles from './Scuole.module.css';

const ScuoleList = ({ scuole, isLoading, isError, errorMessage, onRetry, onEdit }) => {
  const { t } = useTranslation();

  if (isError) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (isLoading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`scuola-skeleton-${index}`} variant="block" height="4rem" />
        ))}
      </div>
    );
  }

  if (!scuole || scuole.length === 0) {
    return (
      <EmptyState
        title={t('scuole.list.emptyTitle')}
        description={t('scuole.list.emptyDescription')}
      />
    );
  }

  return (
    <div className={styles.list}>
      {scuole.map((scuola) => (
        <ScuolaRow key={scuola.id} scuola={scuola} onEdit={onEdit} />
      ))}
    </div>
  );
};

export default ScuoleList;
