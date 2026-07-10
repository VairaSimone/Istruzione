import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorsiList } from '../hooks/useCorsi';
import { STATI_CORSO } from '../constants/domain';
import CorsoCard from '../features/corsi/components/CorsoCard';
import CorsoFormModal from '../features/corsi/components/CorsoFormModal';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import FiltroVocabolario from '../components/ui/FiltroVocabolario';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/corsi/components/Corsi.module.css';

const LIMIT = 12;

/** Catalogo dei corsi di videolezioni della propria scuola (staff). */
const CorsiListPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', stato: '', materia: '', livello: '' });
  const [page, setPage] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.stato && { stato: filters.stato }),
    ...(filters.materia && { materia: filters.materia }),
    ...(filters.livello && { livello: filters.livello }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useCorsiList(queryFilters);
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
          <h1 className={styles.pageTitle}>{t('corsi.list.title')}</h1>
          <p className={styles.pageSubtitle}>{t('corsi.list.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t('corsi.list.create')}</Button>
      </div>

      <div className={styles.filters}>
        <TextField
          label={t('corsi.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('corsi.list.searchPlaceholder')}
        />
        <Select
          label={t('corsi.form.stato')}
          placeholder={t('corsi.list.allStates')}
          value={filters.stato}
          onChange={(e) => updateFilter('stato', e.target.value)}
        >
          {STATI_CORSO.map((s) => (
            <option key={s} value={s}>
              {t(`corsi.stati.${s}`)}
            </option>
          ))}
        </Select>
        <FiltroVocabolario
          vocabolario="materieDisponibili"
          label={t('corsi.form.materia')}
          placeholder={t('corsi.list.allSubjects')}
          value={filters.materia}
          onChange={(valore) => updateFilter('materia', valore)}
        />
        <FiltroVocabolario
          vocabolario="livelliDisponibili"
          label={t('corsi.form.livello')}
          placeholder={t('corsi.list.allLevels')}
          value={filters.livello}
          onChange={(valore) => updateFilter('livello', valore)}
        />
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('corsi.list.loadError')}</p>}

      {!isLoading && !isError && corsi.length === 0 && (
        <p className={styles.emptyText}>{t('corsi.list.empty')}</p>
      )}

      {corsi.length > 0 && (
        <div className={styles.grid}>
          {corsi.map((corso) => (
            <CorsoCard key={corso.id} corso={corso} />
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

      <CorsoFormModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default CorsiListPage;
