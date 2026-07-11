import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCertificatiList } from '../hooks/useCertificati';
import CertificatoCard from '../features/certificati/components/CertificatoCard';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/shared/EmptyState';
import styles from '../features/certificati/components/Certificati.module.css';

const LIMIT = 12;

/** I certificati ricevuti dallo studente, scaricabili in PDF. */
const CertificatiStudentePage = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useCertificatiList({ page, limit: LIMIT });
  const certificati = data?.certificati ?? [];
  const paginazione = data?.paginazione;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('certificati.studente.title')}</h1>
          <p className={styles.pageSubtitle}>{t('certificati.studente.subtitle')}</p>
        </div>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('certificati.studente.loadError')}</p>}

      {!isLoading && !isError && certificati.length === 0 && (
        <EmptyState
          title={t('certificati.studente.emptyTitle')}
          description={t('certificati.studente.emptyDescription')}
        />
      )}

      {certificati.length > 0 && (
        <div className={styles.grid}>
          {certificati.map((c) => (
            <CertificatoCard key={c.id} certificato={c} />
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
    </div>
  );
};

export default CertificatiStudentePage;
