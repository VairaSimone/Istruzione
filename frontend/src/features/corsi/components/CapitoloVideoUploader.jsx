import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useUploadVideoCapitolo, useDeleteVideoCapitolo } from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { formatBytes } from '../../../utils/fileUrl';
import Button from '../../../components/ui/Button';
import FileUploadField from '../../../components/ui/FileUploadField';
import styles from './Corsi.module.css';

/**
 * Caricamento del VIDEO di un capitolo, dal PC (staff).
 *
 * Se il capitolo ha già un video caricato lo si può sostituire (il backend
 * elimina il vecchio binario) oppure rimuovere. Caricare un file azzera
 * l'eventuale `videoUrl` esterno: il file prevale sempre.
 */
const CapitoloVideoUploader = ({ corsoId, capitolo }) => {
  const { t } = useTranslation();
  const uploadVideo = useUploadVideoCapitolo();
  const deleteVideo = useDeleteVideoCapitolo();

  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);

  const videoFile = capitolo.videoFile ?? null;
  const haVideoCaricato = Boolean(capitolo.videoFileId);

  const handleUpload = async () => {
    if (!file) return;
    setProgress(0);
    try {
      await uploadVideo.mutateAsync({
        id: corsoId,
        capitoloId: capitolo.id,
        file,
        onProgress: setProgress,
      });
      toast.success(t('corsi.toast.videoUploaded'));
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('corsi.video.deleteConfirm'))) return;
    try {
      await deleteVideo.mutateAsync({ id: corsoId, capitoloId: capitolo.id });
      toast.success(t('corsi.toast.videoDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <div className={styles.videoBox}>
      <div className={styles.documentiHeader}>
        <span className={styles.documentiTitle}>{t('corsi.video.title')}</span>
        {haVideoCaricato && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            isLoading={deleteVideo.isPending}
          >
            {t('corsi.video.remove')}
          </Button>
        )}
      </div>

      {haVideoCaricato && videoFile && (
        <p className={styles.videoCorrente}>
          <span aria-hidden="true">🎬</span> {videoFile.nomeOriginale}
          <span className={styles.mutedSmall}>
            {' '}
            · {formatBytes(videoFile.dimensioneByte)}
          </span>
        </p>
      )}

      {!haVideoCaricato && capitolo.videoUrl && (
        <p className={styles.mutedSmall}>{t('corsi.video.usaUrlEsterno')}</p>
      )}

      <FileUploadField
        tipo="video"
        label={haVideoCaricato ? t('corsi.video.replace') : t('corsi.video.upload')}
        hint={t('corsi.video.hint')}
        file={file}
        onChange={setFile}
        progress={progress}
        disabled={uploadVideo.isPending}
      />

      {file && (
        <div className={styles.inlineFormActions}>
          <Button size="sm" onClick={handleUpload} isLoading={uploadVideo.isPending}>
            {t('corsi.video.submit')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CapitoloVideoUploader;
