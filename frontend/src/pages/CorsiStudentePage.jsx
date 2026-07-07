import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorsiStudente } from '../hooks/useCorsi';
import { LIVELLI_JLPT } from '../constants/domain';
import CorsoStudenteCard from '../features/corsi/components/CorsoStudenteCard';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/corsi/components/Corsi.module.css';

const LIMIT = 12;

/** Catalogo dei corsi di videolezioni disponibili allo studente. */
const CorsiStudentePage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', livello: '' });
  const [page, setPage] = useState(1);

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.livello && { livello: filters.livello }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useCorsiStudente(queryFilters);
  const corsi = data?.corsi ?? [];
  const paginazione = data?.paginazione;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('corsi.studente.title')}</h1>
          <p className={styles.pageSubtitle}>{t('corsi.studente.subtitle')}</p>
        </div>
      </div>

      <div className={styles.filters}>
        <TextField
          label={t('corsi.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('corsi.list.searchPlaceholder')}
        />
        <Select
          label={t('corsi.form.livelloJLPT')}
          placeholder={t('corsi.list.allLevels')}
          value={filters.livello}
          onChange={(e) => updateFilter('livello', e.target.value)}
        >
          {LIVELLI_JLPT.map((liv) => (
            <option key={liv} value={liv}>
              {liv}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('corsi.studente.loadError')}</p>}

      {!isLoading && !isError && corsi.length === 0 && (
        <p className={styles.emptyText}>{t('corsi.studente.empty')}</p>
      )}

      {corsi.length > 0 && (
        <div className={styles.grid}>
          {corsi.map((corso) => (
            <CorsoStudenteCard key={corso.id} corso={corso} />
          ))}
        </div>
      )}

      {paginazione && paginazione.totalePagine > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className={styles.pageInfo}>
            {t('common.pageOf', {
              page: paginazione.paginaCorrente,
              total: paginazione.totalePagine,
            })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= paginazione.totalePagine}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CorsiStudentePage;
