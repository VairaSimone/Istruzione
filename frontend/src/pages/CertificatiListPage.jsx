import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCertificatiList, useRevocaCertificato } from '../hooks/useCertificati';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import CertificatoCard from '../features/certificati/components/CertificatoCard';
import EmettiCertificatoModal from '../features/certificati/components/EmettiCertificatoModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/certificati/components/Certificati.module.css';

const LIMIT = 12;
const STATI = ['valido', 'revocato'];

/** Certificati della propria scuola (staff): rilascio, elenco, revoca. */
const CertificatiListPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', stato: '' });
  const [page, setPage] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);
  const [daRevocare, setDaRevocare] = useState(null);

  const revoca = useRevocaCertificato();

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.stato && { stato: filters.stato }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useCertificatiList(queryFilters);
  const certificati = data?.certificati ?? [];
  const paginazione = data?.paginazione;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const confermaRevoca = async () => {
    if (!daRevocare) return;
    try {
      await revoca.mutateAsync({ id: daRevocare.id });
      toast.success(t('certificati.toast.revocato'));
      setDaRevocare(null);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('certificati.list.title')}</h1>
          <p className={styles.pageSubtitle}>{t('certificati.list.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t('certificati.list.emetti')}</Button>
      </div>

      <div className={styles.filters}>
        <TextField
          label={t('certificati.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('certificati.list.searchPlaceholder')}
        />
        <Select
          label={t('certificati.list.stato')}
          placeholder={t('certificati.list.allStates')}
          value={filters.stato}
          onChange={(e) => updateFilter('stato', e.target.value)}
        >
          {STATI.map((s) => (
            <option key={s} value={s}>
              {t(`certificati.stati.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('certificati.list.loadError')}</p>}

      {!isLoading && !isError && certificati.length === 0 && (
        <p className={styles.emptyText}>{t('certificati.list.empty')}</p>
      )}

      {certificati.length > 0 && (
        <div className={styles.grid}>
          {certificati.map((c) => (
            <CertificatoCard
              key={c.id}
              certificato={c}
              canManage
              onRevoca={setDaRevocare}
            />
          ))}
        </div>
      )}

      {paginazione && paginazione.totalPages > 1 && (
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
            {t('common.pageOf', { page: paginazione.page, total: paginazione.totalPages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= paginazione.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      <EmettiCertificatoModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />

      <ConfirmDialog
        isOpen={Boolean(daRevocare)}
        title={t('certificati.revoca.title')}
        description={t('certificati.revoca.description', {
          studente: daRevocare?.nomeStudente ?? '',
        })}
        confirmLabel={t('certificati.revoca.confirm')}
        cancelLabel={t('common.cancel')}
        isLoading={revoca.isPending}
        onConfirm={confermaRevoca}
        onCancel={() => setDaRevocare(null)}
      />
    </div>
  );
};

export default CertificatiListPage;
