import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuleList } from '../hooks/useAule';
import { LIVELLI_JLPT } from '../constants/domain';
import AulaCard from '../features/aule/components/AulaCard';
import AulaFormModal from '../features/aule/components/AulaFormModal';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/aule/components/Aule.module.css';

const LIMIT = 12;

/**
 * Elenco delle aule del docente, con ricerca/filtri, paginazione lato server
 * e creazione tramite modal.
 */
const AuleListPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', livello: '', archiviata: '' });
  const [page, setPage] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.livello && { livello: filters.livello }),
    ...(filters.archiviata !== '' && { archiviata: filters.archiviata }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useAuleList(queryFilters);
  const classi = data?.classi ?? [];
  const paginazione = data?.paginazione;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('aule.list.title')}</h1>
          <p className={styles.pageSubtitle}>{t('aule.list.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t('aule.list.create')}</Button>
      </div>

      <div className={styles.filters}>
        <TextField
          label={t('aule.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('aule.list.searchPlaceholder')}
        />
        <Select
          label={t('aule.form.livelloJLPT')}
          placeholder={t('aule.list.allLevels')}
          value={filters.livello}
          onChange={(e) => updateFilter('livello', e.target.value)}
        >
          {LIVELLI_JLPT.map((liv) => (
            <option key={liv} value={liv}>
              {liv}
            </option>
          ))}
        </Select>
        <Select
          label={t('aule.list.statusFilter')}
          placeholder={t('aule.list.statusAll')}
          value={filters.archiviata}
          onChange={(e) => updateFilter('archiviata', e.target.value)}
        >
          <option value="false">{t('aule.list.statusActive')}</option>
          <option value="true">{t('aule.list.statusArchived')}</option>
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('aule.list.loadError')}</p>}

      {!isLoading && !isError && classi.length === 0 && (
        <p className={styles.emptyText}>{t('aule.list.empty')}</p>
      )}

      {classi.length > 0 && (
        <div className={styles.grid}>
          {classi.map((aula) => (
            <AulaCard key={aula.id} aula={aula} />
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

      <AulaFormModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default AuleListPage;
