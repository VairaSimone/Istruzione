import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  buildDocumentoSchema,
  buildDocumentoFileSchema,
} from '../../../validators/corsiSchemas';
import {
  useDeleteCapitolo,
  useAddDocumento,
  useUploadDocumentoFile,
  useDeleteDocumento,
} from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { formatDurata } from '../../../utils/durata';
import { fileUrl, formatBytes } from '../../../utils/fileUrl';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import TextField from '../../../components/ui/TextField';
import FileUploadField from '../../../components/ui/FileUploadField';
import CapitoloFormModal from './CapitoloFormModal';
import CapitoloVideoUploader from './CapitoloVideoUploader';
import styles from './Corsi.module.css';

/** Carica un documento come FILE dal PC (titolo facoltativo). */
const DocumentoFileForm = ({ corsoId, capitoloId }) => {
  const { t } = useTranslation();
  const uploadDocumento = useUploadDocumentoFile();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);

  const schema = buildDocumentoFileSchema(t);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { titolo: '' } });

  const onSubmit = async (values) => {
    if (!file) {
      toast.error(t('upload.errors.nessunFile'));
      return;
    }
    setProgress(0);
    try {
      await uploadDocumento.mutateAsync({
        id: corsoId,
        capitoloId,
        file,
        titolo: values.titolo,
        onProgress: setProgress,
      });
      toast.success(t('corsi.toast.documentoAdded'));
      reset({ titolo: '' });
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FileUploadField
        tipo="documento"
        label={t('corsi.documento.file')}
        hint={t('corsi.documento.fileHint')}
        file={file}
        onChange={setFile}
        progress={progress}
        disabled={uploadDocumento.isPending}
      />
      <div className={styles.inlineForm}>
        <TextField
          label={t('corsi.documento.titoloFacoltativo')}
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <div className={styles.inlineFormActions}>
          <Button type="submit" size="sm" isLoading={uploadDocumento.isPending}>
            {t('corsi.documento.upload')}
          </Button>
        </div>
      </div>
    </form>
  );
};

/** Form inline per allegare un documento tramite URL esterno. */
const DocumentoUrlForm = ({ corsoId, capitoloId }) => {
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

/**
 * Elenco dei documenti di un capitolo, con rimozione e i due modi per
 * aggiungerne: caricamento di un file dal PC (predefinito) oppure URL esterno.
 */
const DocumentiSection = ({ corsoId, capitolo }) => {
  const { t } = useTranslation();
  const deleteDocumento = useDeleteDocumento();
  const [modo, setModo] = useState('file');
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
          {documenti.map((doc) => {
            // Precedenza al file caricato; in mancanza, URL esterno.
            const href = fileUrl(doc.fileId) || doc.url;
            return (
              <li key={doc.id} className={styles.documentoRow}>
                <a
                  className={styles.documentoLink}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.documentoIcon} aria-hidden="true">
                    {doc.fileId ? '📎' : '🔗'}
                  </span>
                  <span>{doc.titolo}</span>
                  {doc.file && (
                    <span className={styles.mutedSmall}>
                      {' '}
                      · {formatBytes(doc.file.dimensioneByte)}
                    </span>
                  )}
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
            );
          })}
        </ul>
      )}

      <div
        className={styles.modoSwitch}
        role="group"
        aria-label={t('corsi.documento.modo')}
      >
        <button
          type="button"
          className={[styles.modoBtn, modo === 'file' ? styles.modoBtnActive : ''].join(
            ' '
          )}
          onClick={() => setModo('file')}
          aria-pressed={modo === 'file'}
        >
          {t('corsi.documento.modoFile')}
        </button>
        <button
          type="button"
          className={[styles.modoBtn, modo === 'url' ? styles.modoBtnActive : ''].join(
            ' '
          )}
          onClick={() => setModo('url')}
          aria-pressed={modo === 'url'}
        >
          {t('corsi.documento.modoUrl')}
        </button>
      </div>

      {modo === 'file' ? (
        <DocumentoFileForm corsoId={corsoId} capitoloId={capitolo.id} />
      ) : (
        <DocumentoUrlForm corsoId={corsoId} capitoloId={capitolo.id} />
      )}
    </div>
  );
};

/**
 * Singolo capitolo (sezione o sotto-capitolo) con metadati, azioni, uploader
 * del video e sezione documenti. Le sezioni di primo livello mostrano anche i
 * propri sotto-capitoli, annidati.
 */
const CapitoloItem = ({ corsoId, capitolo, onEdit, onAddSotto, isSotto = false }) => {
  const { t } = useTranslation();
  const deleteCapitolo = useDeleteCapitolo();
  const [espanso, setEspanso] = useState(false);

  const sottoCapitoli = capitolo.sottoCapitoli ?? [];

  const handleDelete = async () => {
    const messaggio = isSotto
      ? t('corsi.capitolo.deleteConfirm')
      : t('corsi.capitolo.deleteSezioneConfirm');
    if (!window.confirm(messaggio)) return;
    try {
      await deleteCapitolo.mutateAsync({ id: corsoId, capitoloId: capitolo.id });
      toast.success(t('corsi.toast.capitoloDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isInherited = capitolo.scaricabile === null || capitolo.scaricabile === undefined;
  const haVideo = Boolean(capitolo.videoFileId || capitolo.videoUrl);

  return (
    <li
      className={[styles.capitoloItem, isSotto ? styles.sottoCapitoloItem : ''].join(' ')}
    >
      <div className={styles.capitoloHead}>
        <div className={styles.capitoloTitleWrap}>
          <span className={styles.capitoloOrdine}>#{capitolo.ordine}</span>
          <h4 className={styles.capitoloTitle}>{capitolo.titolo}</h4>
          <div className={styles.capitoloMeta}>
            {!isSotto && (
              <Badge tone="gold">
                {t('corsi.capitolo.sezione', { n: sottoCapitoli.length })}
              </Badge>
            )}
            {haVideo ? (
              <Badge tone="seal">
                {capitolo.videoFileId
                  ? t('corsi.capitolo.videoCaricato')
                  : t('corsi.capitolo.videoEsterno')}
              </Badge>
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
            onClick={() => setEspanso((v) => !v)}
            aria-expanded={espanso}
            aria-label={t('corsi.capitolo.toggleContenuti')}
          >
            {espanso ? '▾' : '▸'}
          </button>
          {!isSotto && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => onAddSotto(capitolo)}
              aria-label={t('corsi.capitolo.addSotto')}
              title={t('corsi.capitolo.addSotto')}
            >
              ＋
            </button>
          )}
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

      {espanso && (
        <>
          <CapitoloVideoUploader corsoId={corsoId} capitolo={capitolo} />
          <DocumentiSection corsoId={corsoId} capitolo={capitolo} />
        </>
      )}

      {sottoCapitoli.length > 0 && (
        <ul className={styles.sottoCapitoloList}>
          {sottoCapitoli.map((sotto) => (
            <CapitoloItem
              key={sotto.id}
              corsoId={corsoId}
              capitolo={sotto}
              onEdit={onEdit}
              onAddSotto={onAddSotto}
              isSotto
            />
          ))}
        </ul>
      )}
    </li>
  );
};

/**
 * Pannello di gestione dei capitoli del corso (staff).
 *
 * Il backend restituisce un albero a DUE livelli: `capitoli` sono le sezioni di
 * primo livello, ognuna con i propri `sottoCapitoli` (stile Udemy).
 */
const CapitoliPanel = ({ corso }) => {
  const { t } = useTranslation();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [padreId, setPadreId] = useState(null);
  const sezioni = corso.capitoli ?? [];

  const openCreateSezione = () => {
    setEditing(null);
    setPadreId(null);
    setModalOpen(true);
  };

  const openCreateSotto = (sezione) => {
    setEditing(null);
    setPadreId(sezione.id);
    setModalOpen(true);
  };

  const openEdit = (capitolo) => {
    setEditing(capitolo);
    setPadreId(null);
    setModalOpen(true);
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('corsi.capitolo.panelTitle')}</h3>
        <Button size="sm" onClick={openCreateSezione}>
          {t('corsi.capitolo.addSezione')}
        </Button>
      </div>

      {sezioni.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.capitolo.empty')}</p>
      ) : (
        <ul className={styles.capitoloList}>
          {sezioni.map((sezione) => (
            <CapitoloItem
              key={sezione.id}
              corsoId={corso.id}
              capitolo={sezione}
              onEdit={openEdit}
              onAddSotto={openCreateSotto}
            />
          ))}
        </ul>
      )}

      <CapitoloFormModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        corsoId={corso.id}
        capitolo={editing}
        capitoloPadreId={padreId}
        sezioni={sezioni}
      />
    </Card>
  );
};

export default CapitoliPanel;
