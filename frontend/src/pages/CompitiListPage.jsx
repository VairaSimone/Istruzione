import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompitiList } from '../hooks/useCompiti';
import { STATI_COMPITO, TIPI_ATTIVITA_COMPITO } from '../constants/domain';
import CompitoCard from '../features/compiti/components/CompitoCard';
import CompitoFormModal from '../features/compiti/components/CompitoFormModal';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/compiti/components/Compiti.module.css';

const LIMIT = 12;

/** Elenco dei compiti creati dal docente, con filtri, paginazione e creazione. */
const CompitiListPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', stato: '', tipo: '' });
  const [page, setPage] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.stato && { stato: filters.stato }),
    ...(filters.tipo && { tipo: filters.tipo }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useCompitiList(queryFilters);
  const compiti = data?.compiti ?? [];
  const paginazione = data?.paginazione;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('compiti.list.title')}</h1>
          <p className={styles.pageSubtitle}>{t('compiti.list.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t('compiti.list.create')}</Button>
      </div>

      <div className={styles.filters}>
        <TextField
          label={t('compiti.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('compiti.list.searchPlaceholder')}
        />
        <Select
          label={t('compiti.form.stato')}
          placeholder={t('compiti.list.allStates')}
          value={filters.stato}
          onChange={(e) => updateFilter('stato', e.target.value)}
        >
          {STATI_COMPITO.map((s) => (
            <option key={s} value={s}>
              {t(`compiti.stati.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('compiti.form.tipoAttivita')}
          placeholder={t('compiti.list.allTypes')}
          value={filters.tipo}
          onChange={(e) => updateFilter('tipo', e.target.value)}
        >
          {TIPI_ATTIVITA_COMPITO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`compiti.tipi.${tipo}`)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('compiti.list.loadError')}</p>}

      {!isLoading && !isError && compiti.length === 0 && (
        <p className={styles.emptyText}>{t('compiti.list.empty')}</p>
      )}

      {compiti.length > 0 && (
        <div className={styles.grid}>
          {compiti.map((compito) => (
            <CompitoCard key={compito.id} compito={compito} />
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

      <CompitoFormModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default CompitiListPage;
