import { useState } from 'react';
import { useUsersList } from '../hooks/useUsersList';
import { parseApiError } from '../utils/parseApiError';
import UsersFilterBar from '../features/users/components/UsersFilterBar';
import UsersTable from '../features/users/components/UsersTable';
import styles from './UsersManagementPage.module.css';

const UsersManagementPage = () => {
  const [filters, setFilters] = useState({});
  const { data, isLoading, isError, error, refetch } = useUsersList(filters);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Gestione utenti</h1>
        <p className={styles.subtitle}>
          Visualizza, filtra e gestisci gli account registrati sulla piattaforma.
        </p>
      </header>

      <UsersFilterBar currentFilters={filters} onFilterChange={setFilters} />

      <UsersTable
        users={data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={isError ? parseApiError(error) : null}
        onRetry={refetch}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
};

export default UsersManagementPage;
