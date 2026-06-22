import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsersList } from '../hooks/useUsersList';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import UsersFilterBar from '../features/users/components/UsersFilterBar';
import UsersTable from '../features/users/components/UsersTable';
import styles from './UsersManagementPage.module.css';

const UsersManagementPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({});
  const { data, isLoading, isError, error, refetch } = useUsersList(filters);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('users.managementTitle')}</h1>
        <p className={styles.subtitle}>{t('users.managementSubtitle')}</p>
      </header>

      <UsersFilterBar currentFilters={filters} onFilterChange={setFilters} />

      <UsersTable
        users={data ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={isError ? getApiErrorMessage(t, error) : null}
        onRetry={refetch}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
};

export default UsersManagementPage;
