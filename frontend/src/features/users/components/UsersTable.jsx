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

const UsersTable = ({ users, isLoading, isError, error, onRetry, hasActiveFilters }) => {
  if (isError) {
    return <ErrorState message={error?.message} onRetry={onRetry} />;
  }

  if (!isLoading && users.length === 0) {
    return (
      <EmptyState
        title={
          hasActiveFilters
            ? 'Nessun utente corrisponde ai filtri'
            : 'Nessun utente registrato'
        }
        description={
          hasActiveFilters
            ? 'Prova a modificare o reimpostare i filtri di ricerca.'
            : 'Quando gli studenti si registreranno, compariranno qui.'
        }
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Utente</th>
            <th scope="col">Classe</th>
            <th scope="col">Stato email</th>
            <th scope="col">Ruolo</th>
            <th scope="col">
              <span className="visually-hidden">Azioni</span>
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
