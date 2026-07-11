import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsersList } from '../hooks/useUsersList';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import UsersFilterBar from '../features/users/components/UsersFilterBar';
import UsersTable from '../features/users/components/UsersTable';
import Pagination from '../components/shared/Pagination';
import styles from './UsersManagementPage.module.css';

// Utenti per pagina. Il backend applica la paginazione via findAndCountAll
// quando riceve page/limit.
const PER_PAGE = 20;

const UsersManagementPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);

  // I filtri utente e la paginazione confluiscono in un'unica chiave: ogni
  // pagina/filtro è una entry di cache React Query distinta.
  const { data, isLoading, isFetching, isError, error, refetch } = useUsersList({
    ...filters,
    page,
    limit: PER_PAGE,
  });

  const utenti = data?.utenti ?? [];
  const paginazione = data?.paginazione ?? null;
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Cambiare i filtri deve riportare alla prima pagina: la pagina 5 di un
  // risultato filtrato potrebbe non esistere.
  const handleFilterChange = useCallback((nuoviFiltri) => {
    setFilters(nuoviFiltri);
    setPage(1);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('users.managementTitle')}</h1>
        <p className={styles.subtitle}>{t('users.managementSubtitle')}</p>
      </header>

      <UsersFilterBar currentFilters={filters} onFilterChange={handleFilterChange} />

      <UsersTable
        users={utenti}
        isLoading={isLoading}
        isError={isError}
        errorMessage={isError ? getApiErrorMessage(t, error) : null}
        onRetry={refetch}
        hasActiveFilters={hasActiveFilters}
      />

      {paginazione && (
        <Pagination
          paginaCorrente={paginazione.paginaCorrente}
          totalePagine={paginazione.totalePagine}
          totaleElementi={paginazione.totaleElementi}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default UsersManagementPage;
