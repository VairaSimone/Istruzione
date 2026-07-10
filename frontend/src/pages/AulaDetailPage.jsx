import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAula, useDeleteAula } from '../hooks/useAule';
import { ROUTES } from '../constants/routes';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import AulaFormModal from '../features/aule/components/AulaFormModal';
import MembersPanel from '../features/aule/components/MembersPanel';
import AddMemberForm from '../features/aule/components/AddMemberForm';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/aule/components/Aule.module.css';

/**
 * Dettaglio di un'aula: intestazione con metadati e azioni (modifica/elimina),
 * pannello membri e form di aggiunta/invito.
 */
const AulaDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: aula, isLoading, isError } = useAula(id);
  const deleteAula = useDeleteAula();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('aule.detail.deleteConfirm'))) return;
    try {
      await deleteAula.mutateAsync(id);
      toast.success(t('aule.toast.deleted'));
      navigate(ROUTES.AULE);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !aula) return <p className={styles.emptyText}>{t('aule.detail.loadError')}</p>;

  return (
    <div>
      <Link to={ROUTES.AULE} className={styles.backLink}>
        ← {t('aule.detail.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{aula.nome}</h1>
          {aula.descrizione && <p className={styles.pageSubtitle}>{aula.descrizione}</p>}
          <div className={styles.cardMeta}>
            {aula.livello && <Badge tone="matcha">{aula.livello}</Badge>}
            {aula.annoScolastico && <Badge tone="gold">{aula.annoScolastico}</Badge>}
            {aula.archiviata && <Badge tone="neutral">{t('aule.archived')}</Badge>}
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button
            variant="ghost"
            onClick={() => navigate(`${ROUTES.TEACHER_DASHBOARD}?aula=${aula.id}`)}
          >
            {t('aule.detail.statistics')}
          </Button>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteAula.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <MembersPanel aula={aula} />
      <AddMemberForm aulaId={aula.id} />

      <AulaFormModal isOpen={isEditOpen} onClose={() => setEditOpen(false)} aula={aula} />
    </div>
  );
};

export default AulaDetailPage;
