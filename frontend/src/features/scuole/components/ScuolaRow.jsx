import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useDeleteScuola } from '../../../hooks/useScuole';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './Scuole.module.css';

/**
 * Riga di una scuola nell'elenco admin: nome, conteggi utenti/aule e azioni
 * (modifica / elimina). L'eliminazione richiede conferma ed è bloccata
 * server-side se la scuola ha ancora utenti collegati.
 */
const ScuolaRow = ({ scuola, onEdit }) => {
  const { t } = useTranslation();
  const deleteScuola = useDeleteScuola();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const utenti = scuola.conteggio?.utenti ?? 0;
  const aule = scuola.conteggio?.aule ?? 0;

  const handleDelete = async () => {
    try {
      await deleteScuola.mutateAsync(scuola.id);
      toast.success(t('scuole.toast.deleted'));
      setConfirmOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className={styles.item}>
        <div className={styles.itemMain}>
          <span className={styles.itemName}>{scuola.nome}</span>
          <span className={styles.itemMeta}>
            <Badge tone="neutral">{t('scuole.list.utentiCount', { count: utenti })}</Badge>
            <Badge tone="neutral">{t('scuole.list.auleCount', { count: aule })}</Badge>
          </span>
        </div>
        <div className={styles.itemActions}>
          <Button variant="secondary" size="sm" onClick={() => onEdit(scuola)}>
            {t('common.edit')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={utenti > 0}
            title={utenti > 0 ? t('scuole.list.deleteBlocked') : undefined}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('scuole.delete.title')}
        description={t('scuole.delete.description', { nome: scuola.nome })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isLoading={deleteScuola.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default ScuolaRow;
