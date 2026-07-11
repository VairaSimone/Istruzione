import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useUploadRisorsaCertificato } from '../../../hooks/useCertificati';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { certificatoRisorsaUrl } from '../../../utils/certificatoUrl';
import Button from '../../../components/ui/Button';
import FileUploadField from '../../../components/ui/FileUploadField';
import styles from './Certificati.module.css';

/**
 * Caricamento di una RISORSA immagine (logo o firma) del modello certificato.
 *
 * L'immagine viene inviata a `POST /api/certificati/risorse`; il fileId
 * restituito viene comunicato al chiamante via `onChange`, che lo salva nelle
 * impostazioni della scuola (`certificato.logoFileId` / `firmaFileId`). Solo
 * PNG/JPEG sono incorporabili nel PDF.
 *
 * @param {string|null} fileId    id corrente (o null)
 * @param {Function}    onChange  (fileId|null) => void
 * @param {string}      label
 * @param {string}      hint
 */
const CertificatoRisorsaUpload = ({ fileId = null, onChange, label, hint }) => {
  const { t } = useTranslation();
  const upload = useUploadRisorsaCertificato();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);

  const anteprima = certificatoRisorsaUrl(fileId);

  const handleUpload = async () => {
    if (!file) return;
    setProgress(0);
    try {
      const salvato = await upload.mutateAsync({ file, onProgress: setProgress });
      onChange?.(salvato.id);
      setFile(null);
      toast.success(t('certificati.config.risorsaCaricata'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className={styles.risorsaBox}>
      <span className={styles.risorsaLabel}>{label}</span>

      <div className={styles.risorsaPreview}>
        {anteprima ? (
          <img src={anteprima} alt={label} loading="lazy" />
        ) : (
          <span className={styles.risorsaVuota}>{t('certificati.config.nessunaImmagine')}</span>
        )}
      </div>

      <FileUploadField
        tipo="immagine"
        hint={hint}
        file={file}
        onChange={setFile}
        progress={progress}
        disabled={upload.isPending}
      />

      <div className={styles.risorsaAzioni}>
        {file && (
          <Button size="sm" onClick={handleUpload} isLoading={upload.isPending}>
            {t('certificati.config.caricaImmagine')}
          </Button>
        )}
        {fileId && !file && (
          <Button size="sm" variant="ghost" onClick={() => onChange?.(null)}>
            {t('certificati.config.rimuoviImmagine')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CertificatoRisorsaUpload;
