import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPT_PER_TIPO, validaFile } from '../../constants/upload';
import { formatBytes } from '../../utils/fileUrl';
import styles from './FileUploadField.module.css';

/**
 * Campo di caricamento file (drag & drop + selezione da PC), con validazione
 * client-side di MIME e dimensione, anteprima del file scelto e barra di
 * avanzamento durante l'upload.
 *
 * Singola responsabilità: SELEZIONE e feedback visivo. Non esegue la chiamata
 * di rete: comunica il File scelto al chiamante tramite `onChange`, che decide
 * quando e come inviarlo.
 *
 * @param {'video'|'immagine'|'documento'} tipo  determina accept, limiti e MIME
 * @param {File|null}  file        file attualmente selezionato
 * @param {Function}   onChange    (file|null) => void
 * @param {number|null} progress   0-100 durante l'upload, null a riposo
 * @param {boolean}    disabled
 * @param {string}     error       errore esterno (es. del server)
 */
const FileUploadField = ({
  tipo,
  label,
  hint,
  file = null,
  onChange,
  progress = null,
  disabled = false,
  error = null,
  required = false,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [isDragging, setDragging] = useState(false);
  const [errorLocale, setErrorLocale] = useState(null);

  const isUploading = progress !== null && progress >= 0 && progress < 100;
  const messaggioErrore = error || errorLocale;

  const accetta = (candidato) => {
    if (!candidato) return;

    const esito = validaFile(tipo, candidato);
    if (esito) {
      setErrorLocale(t(esito.key, esito.params));
      onChange?.(null);
      return;
    }

    setErrorLocale(null);
    onChange?.(candidato);
  };

  const handleInputChange = (e) => {
    accetta(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || isUploading) return;
    accetta(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !isUploading) setDragging(true);
  };

  const apriSelettore = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const rimuovi = (e) => {
    e.stopPropagation();
    setErrorLocale(null);
    if (inputRef.current) inputRef.current.value = '';
    onChange?.(null);
  };

  const classi = [
    styles.dropzone,
    isDragging ? styles.dragging : '',
    messaggioErrore ? styles.dropzoneError : '',
    disabled || isUploading ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.label} id={`${id}-label`}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
      )}

      <div
        className={classi}
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={messaggioErrore ? errorId : hint ? hintId : undefined}
        aria-invalid={Boolean(messaggioErrore)}
        aria-disabled={disabled || isUploading}
        onClick={apriSelettore}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            apriSelettore();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          className={styles.input}
          accept={ACCEPT_PER_TIPO[tipo]}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          tabIndex={-1}
        />

        {file ? (
          <div className={styles.selected}>
            <span className={styles.fileIcon} aria-hidden="true">
              {tipo === 'video' ? '🎬' : tipo === 'immagine' ? '🖼' : '📄'}
            </span>
            <span className={styles.fileInfo}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatBytes(file.size)}</span>
            </span>
            {!isUploading && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={rimuovi}
                aria-label={t('upload.remove')}
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.dropIcon} aria-hidden="true">
              ⬆
            </span>
            <span className={styles.dropText}>{t('upload.dropzone')}</span>
            <span className={styles.dropBrowse}>{t('upload.browse')}</span>
          </div>
        )}
      </div>

      {isUploading && (
        <div className={styles.progressWrap}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('upload.uploading')}
          >
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {t('upload.progress', { percent: progress })}
          </span>
        </div>
      )}

      {hint && !messaggioErrore && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {messaggioErrore && (
        <span id={errorId} className={styles.error} role="alert">
          {messaggioErrore}
        </span>
      )}
    </div>
  );
};

export default FileUploadField;
