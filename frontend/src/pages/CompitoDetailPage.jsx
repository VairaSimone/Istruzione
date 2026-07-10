import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCompito, useDeleteCompito } from '../hooks/useCompiti';
import { ROUTES } from '../constants/routes';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { formatDateTime } from '../utils/datetime';
import { STATO_COMPITO_TONE } from '../features/compiti/statoTone';
import CompitoFormModal from '../features/compiti/components/CompitoFormModal';
import AssegnazioniPanel from '../features/compiti/components/AssegnazioniPanel';
import ConsegnePanel from '../features/compiti/components/ConsegnePanel';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/compiti/components/Compiti.module.css';
import { etichettaTipoAttivita } from '../constants/tipiAttivita';

/** Dettaglio compito (docente): metadati, statistiche, assegnazioni e consegne. */
const CompitoDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: compito, isLoading, isError } = useCompito(id);
  const deleteCompito = useDeleteCompito();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('compiti.detail.deleteConfirm'))) return;
    try {
      await deleteCompito.mutateAsync(id);
      toast.success(t('compiti.toast.deleted'));
      navigate(ROUTES.COMPITI);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !compito)
    return <p className={styles.emptyText}>{t('compiti.detail.loadError')}</p>;

  const stat = compito.statistiche || {};

  return (
    <div>
      <Link to={ROUTES.COMPITI} className={styles.backLink}>
        ← {t('compiti.detail.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{compito.titolo}</h1>
          {compito.descrizione && <p className={styles.pageSubtitle}>{compito.descrizione}</p>}
          <div className={styles.cardMeta}>
            <Badge tone={STATO_COMPITO_TONE[compito.stato] || 'neutral'}>
              {t(`compiti.stati.${compito.stato}`)}
            </Badge>
            <Badge tone="neutral">{t(etichettaTipoAttivita(compito.tipoAttivita))}</Badge>
            <span className={styles.mutedSmall}>
              {t('compiti.card.scadenza', {
                data: formatDateTime(compito.dataScadenza, i18n.language),
              })}
            </span>
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteCompito.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <Card>
        <div className={styles.statsRow}>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{stat.destinatari ?? 0}</span>
            <span className={styles.statLabel}>{t('compiti.detail.statDestinatari')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{stat.completati ?? 0}</span>
            <span className={styles.statLabel}>{t('compiti.detail.statCompletati')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{stat.percentualeCompletamento ?? 0}%</span>
            <span className={styles.statLabel}>{t('compiti.detail.statPercentuale')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{compito.punteggioMassimo}</span>
            <span className={styles.statLabel}>{t('compiti.detail.statPunteggio')}</span>
          </div>
        </div>
      </Card>

      <div className={styles.panels}>
        <AssegnazioniPanel compito={compito} />
        <ConsegnePanel compito={compito} />
      </div>

      <CompitoFormModal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        compito={compito}
      />
    </div>
  );
};

export default CompitoDetailPage;
