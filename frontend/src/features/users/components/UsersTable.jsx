import { useTranslation } from 'react-i18next';
import UserRow from './UserRow';
import Skeleton from '../../../components/shared/Skeleton';
import EmptyState from '../../../components/shared/EmptyState';
import ErrorState from '../../../components/shared/ErrorState';
import styles from './UsersTable.module.css';

const SkeletonRow = () => (
  <tr>
    <td colSpan={5} style={{ padding: 'var(--space-4)' }}>
      <Skeleton variant="block" height="2.5rem" />
    </td>
  </tr>
);

const UsersTable = ({
  users,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  hasActiveFilters,
}) => {
  const { t } = useTranslation();

  if (isError) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (!isLoading && users.length === 0) {
    return (
      <EmptyState
        title={
          hasActiveFilters
            ? t('users.table.emptyFilteredTitle')
            : t('users.table.emptyAllTitle')
        }
        description={
          hasActiveFilters
            ? t('users.table.emptyFilteredDescription')
            : t('users.table.emptyAllDescription')
        }
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('users.table.headerUser')}</th>
            <th scope="col">{t('users.table.headerClasse')}</th>
            <th scope="col">{t('users.table.headerEmailStatus')}</th>
            <th scope="col">{t('users.table.headerRole')}</th>
            <th scope="col">
              <span className="visually-hidden">
                {t('users.table.headerActionsAria')}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <SkeletonRow key={`skeleton-${index}`} />
              ))
            : users.map((utente) => <UserRow key={utente.id} utente={utente} />)}
        </tbody>
      </table>
    </div>
  );
};

export default UsersTable;
