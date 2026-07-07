import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCorso, useDeleteCorso } from '../hooks/useCorsi';
import { ROUTES } from '../constants/routes';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { STATO_CORSO_TONE } from '../features/corsi/statoTone';
import CorsoFormModal from '../features/corsi/components/CorsoFormModal';
import CapitoliPanel from '../features/corsi/components/CapitoliPanel';
import DisponibilitaPanel from '../features/corsi/components/DisponibilitaPanel';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/corsi/components/Corsi.module.css';

/** Dettaglio corso (staff): metadati, capitoli, documenti e disponibilità. */
const CorsoDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: corso, isLoading, isError } = useCorso(id);
  const deleteCorso = useDeleteCorso();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('corsi.detail.deleteConfirm'))) return;
    try {
      await deleteCorso.mutateAsync(id);
      toast.success(t('corsi.toast.deleted'));
      navigate(ROUTES.CORSI);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !corso)
    return <p className={styles.emptyText}>{t('corsi.detail.loadError')}</p>;

  return (
    <div>
      <Link to={ROUTES.CORSI} className={styles.backLink}>
        {t('corsi.detail.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{corso.titolo}</h1>
          {corso.descrizione && (
            <p className={styles.pageSubtitle}>{corso.descrizione}</p>
          )}
          <div className={styles.cardMeta}>
            <Badge tone={STATO_CORSO_TONE[corso.stato] || 'neutral'}>
              {t(`corsi.stati.${corso.stato}`)}
            </Badge>
            {corso.livelloJLPT && <Badge tone="neutral">{corso.livelloJLPT}</Badge>}
            <Badge tone={corso.videoScaricabile ? 'matcha' : 'neutral'}>
              {corso.videoScaricabile
                ? t('corsi.detail.downloadDefaultOn')
                : t('corsi.detail.downloadDefaultOff')}
            </Badge>
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteCorso.isPending}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <Card>
        <div className={styles.statsRow}>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{corso.conteggioCapitoli ?? 0}</span>
            <span className={styles.statLabel}>{t('corsi.detail.statCapitoli')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{corso.auleDisponibili?.length ?? 0}</span>
            <span className={styles.statLabel}>{t('corsi.detail.statAule')}</span>
          </div>
        </div>
      </Card>

      <div className={styles.panels}>
        <CapitoliPanel corso={corso} />
        <DisponibilitaPanel corso={corso} />
      </div>

      <CorsoFormModal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        corso={corso}
      />
    </div>
  );
};

export default CorsoDetailPage;
