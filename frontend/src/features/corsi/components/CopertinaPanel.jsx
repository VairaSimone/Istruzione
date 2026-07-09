import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useUploadCopertina, useDeleteCopertina } from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { fileUrl } from '../../../utils/fileUrl';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import FileUploadField from '../../../components/ui/FileUploadField';
import styles from './Corsi.module.css';

/**
 * Pannello della COPERTINA del corso (staff).
 *
 * L'immagine si carica come file dal PC. Il corso può comunque avere una
 * `copertinaUrl` esterna impostata dal form del corso: quando si carica un
 * file, il backend azzera l'URL e il file prevale. L'anteprima riflette la
 * stessa precedenza.
 */
const CopertinaPanel = ({ corso }) => {
  const { t } = useTranslation();
  const uploadCopertina = useUploadCopertina();
  const deleteCopertina = useDeleteCopertina();

  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);

  const anteprima = fileUrl(corso.copertinaFileId) || corso.copertinaUrl || null;
  const haFileCaricato = Boolean(corso.copertinaFileId);

  const handleUpload = async () => {
    if (!file) return;
    setProgress(0);
    try {
      await uploadCopertina.mutateAsync({
        id: corso.id,
        file,
        onProgress: setProgress,
      });
      toast.success(t('corsi.toast.copertinaUploaded'));
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('corsi.copertina.deleteConfirm'))) return;
    try {
      await deleteCopertina.mutateAsync(corso.id);
      toast.success(t('corsi.toast.copertinaDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('corsi.copertina.title')}</h3>
        {haFileCaricato && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            isLoading={deleteCopertina.isPending}
          >
            {t('corsi.copertina.remove')}
          </Button>
        )}
      </div>

      <div className={styles.copertinaPreview}>
        {anteprima ? (
          <img src={anteprima} alt={t('corsi.copertina.alt')} loading="lazy" />
        ) : (
          <span className={styles.coverFallback} aria-hidden="true">
            日
          </span>
        )}
      </div>

      <FileUploadField
        tipo="immagine"
        label={t('corsi.copertina.upload')}
        hint={t('corsi.copertina.hint')}
        file={file}
        onChange={setFile}
        progress={progress}
        disabled={uploadCopertina.isPending}
      />

      {file && (
        <div className={styles.inlineFormActions}>
          <Button size="sm" onClick={handleUpload} isLoading={uploadCopertina.isPending}>
            {t('corsi.copertina.submit')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default CopertinaPanel;
