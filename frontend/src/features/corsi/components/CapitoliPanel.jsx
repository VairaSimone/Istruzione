import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildDocumentoSchema } from '../../../validators/corsiSchemas';
import {
  useDeleteCapitolo,
  useAddDocumento,
  useDeleteDocumento,
} from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { formatDurata } from '../../../utils/durata';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import TextField from '../../../components/ui/TextField';
import CapitoloFormModal from './CapitoloFormModal';
import styles from './Corsi.module.css';

/** Form inline per aggiungere un documento a un capitolo. */
const DocumentoInlineForm = ({ corsoId, capitoloId }) => {
  const { t } = useTranslation();
  const addDocumento = useAddDocumento();
  const schema = buildDocumentoSchema(t);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { titolo: '', url: '' } });

  const onSubmit = async (values) => {
    try {
      await addDocumento.mutateAsync({ id: corsoId, capitoloId, ...values });
      toast.success(t('corsi.toast.documentoAdded'));
      reset({ titolo: '', url: '' });
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <form className={styles.inlineForm} onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField
        label={t('corsi.documento.titolo')}
        error={errors.titolo?.message}
        {...register('titolo')}
      />
      <TextField
        label={t('corsi.documento.url')}
        error={errors.url?.message}
        {...register('url')}
      />
      <div className={styles.inlineFormActions}>
        <Button type="submit" size="sm" isLoading={addDocumento.isPending}>
          {t('common.add')}
        </Button>
      </div>
    </form>
  );
};

/** Elenco dei documenti di un capitolo, con rimozione. */
const DocumentiSection = ({ corsoId, capitolo }) => {
  const { t } = useTranslation();
  const deleteDocumento = useDeleteDocumento();
  const documenti = capitolo.documenti ?? [];

  const handleDelete = async (documentoId) => {
    if (!window.confirm(t('corsi.documento.deleteConfirm'))) return;
    try {
      await deleteDocumento.mutateAsync({
        id: corsoId,
        capitoloId: capitolo.id,
        documentoId,
      });
      toast.success(t('corsi.toast.documentoDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <div className={styles.documentiBox}>
      <div className={styles.documentiHeader}>
        <span className={styles.documentiTitle}>{t('corsi.documento.title')}</span>
      </div>

      {documenti.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.documento.empty')}</p>
      ) : (
        <ul className={styles.documentoList}>
          {documenti.map((doc) => (
            <li key={doc.id} className={styles.documentoRow}>
              <a
                className={styles.documentoLink}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.documentoIcon} aria-hidden="true">
                  📄
                </span>
                <span>{doc.titolo}</span>
              </a>
              <button
                type="button"
                className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
                onClick={() => handleDelete(doc.id)}
                aria-label={t('common.remove')}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentoInlineForm corsoId={corsoId} capitoloId={capitolo.id} />
    </div>
  );
};

/** Singolo capitolo con metadati, azioni e sezione documenti. */
const CapitoloItem = ({ corsoId, capitolo, onEdit }) => {
  const { t } = useTranslation();
  const deleteCapitolo = useDeleteCapitolo();

  const handleDelete = async () => {
    if (!window.confirm(t('corsi.capitolo.deleteConfirm'))) return;
    try {
      await deleteCapitolo.mutateAsync({ id: corsoId, capitoloId: capitolo.id });
      toast.success(t('corsi.toast.capitoloDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isInherited = capitolo.scaricabile === null || capitolo.scaricabile === undefined;

  return (
    <li className={styles.capitoloItem}>
      <div className={styles.capitoloHead}>
        <div className={styles.capitoloTitleWrap}>
          <span className={styles.capitoloOrdine}>#{capitolo.ordine}</span>
          <h4 className={styles.capitoloTitle}>{capitolo.titolo}</h4>
          <div className={styles.capitoloMeta}>
            {capitolo.videoUrl ? (
              <Badge tone="seal">{t('corsi.capitolo.hasVideo')}</Badge>
            ) : (
              <Badge tone="neutral">{t('corsi.capitolo.noVideo')}</Badge>
            )}
            {capitolo.videoDurataSecondi ? (
              <span className={styles.mutedSmall}>
                {formatDurata(capitolo.videoDurataSecondi)}
              </span>
            ) : null}
            <Badge tone={capitolo.scaricabileEffettivo ? 'matcha' : 'neutral'}>
              {capitolo.scaricabileEffettivo
                ? t('corsi.capitolo.downloadOn')
                : t('corsi.capitolo.downloadOff')}
              {isInherited ? ` · ${t('corsi.capitolo.inherited')}` : ''}
            </Badge>
          </div>
        </div>
        <div className={styles.capitoloActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onEdit(capitolo)}
            aria-label={t('common.edit')}
          >
            ✎
          </button>
          <button
            type="button"
            className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
            onClick={handleDelete}
            aria-label={t('common.delete')}
          >
            🗑
          </button>
        </div>
      </div>

      {capitolo.descrizione && (
        <p className={styles.mutedSmall}>{capitolo.descrizione}</p>
      )}

      <DocumentiSection corsoId={corsoId} capitolo={capitolo} />
    </li>
  );
};

/** Pannello di gestione dei capitoli del corso (staff). */
const CapitoliPanel = ({ corso }) => {
  const { t } = useTranslation();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const capitoli = corso.capitoli ?? [];

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (capitolo) => {
    setEditing(capitolo);
    setModalOpen(true);
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('corsi.capitolo.panelTitle')}</h3>
        <Button size="sm" onClick={openCreate}>
          {t('corsi.capitolo.add')}
        </Button>
      </div>

      {capitoli.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.capitolo.empty')}</p>
      ) : (
        <ul className={styles.capitoloList}>
          {capitoli.map((capitolo) => (
            <CapitoloItem
              key={capitolo.id}
              corsoId={corso.id}
              capitolo={capitolo}
              onEdit={openEdit}
            />
          ))}
        </ul>
      )}

      <CapitoloFormModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        corsoId={corso.id}
        capitolo={editing}
      />
    </Card>
  );
};

export default CapitoliPanel;
