import { useTranslation } from 'react-i18next';
import { fileUrl } from '../../../utils/fileUrl';
import styles from './Corsi.module.css';

/**
 * Riconosce i provider di streaming più comuni (YouTube/Vimeo) e restituisce
 * l'URL di embed; per qualunque altro URL lo tratta come file video diretto.
 */
const analizzaVideoUrl = (url) => {
  if (!url) return { tipo: 'assente' };
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube: youtu.be/ID · youtube.com/watch?v=ID · youtube.com/embed/ID
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return { tipo: 'embed', embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (u.pathname.startsWith('/embed/')) {
        return { tipo: 'embed', embedUrl: `https://www.youtube.com${u.pathname}` };
      }
      const v = u.searchParams.get('v');
      if (v) return { tipo: 'embed', embedUrl: `https://www.youtube.com/embed/${v}` };
    }

    // Vimeo: vimeo.com/NUMERICID · player.vimeo.com/video/NUMERICID
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { tipo: 'embed', embedUrl: `https://player.vimeo.com/video/${id}` };
      }
    }
    if (host === 'player.vimeo.com') {
      return { tipo: 'embed', embedUrl: url };
    }

    return { tipo: 'file', fileUrl: url, protetto: false };
  } catch {
    return { tipo: 'file', fileUrl: url, protetto: false };
  }
};

/**
 * Player di un capitolo.
 *
 * PRECEDENZA (coerente con il backend): se il capitolo ha un video CARICATO
 * (`videoFileId`) lo si riproduce dall'endpoint protetto
 * `GET /api/corsi/files/:fileId`, che autentica il richiedente e supporta le
 * richieste Range (seek). Altrimenti si ricade sull'eventuale `videoUrl`
 * esterno (YouTube/Vimeo in iframe, altri URL come file diretto).
 *
 * DOWNLOAD: per i file protetti è il backend a decidere il `Content-Disposition`
 * (`attachment` solo se la policy lo consente); per questo il link NON usa
 * l'attributo `download`, che i browser ignorano comunque cross-origin. Per i
 * file esterni resta l'enforcement "di prodotto" (`controlsList="nodownload"` e
 * blocco del menu contestuale): un blocco tecnico forte richiederebbe DRM.
 *
 * @param {string}  videoFileId  id del file video caricato (ha la precedenza)
 * @param {string}  videoUrl     URL esterno alternativo
 * @param {boolean} scaricabile  policy di download EFFETTIVA (risolta lato backend)
 * @param {string}  titolo       usato come nome file suggerito per il download
 */
const VideoPlayer = ({ videoFileId, videoUrl, scaricabile, titolo }) => {
  const { t } = useTranslation();

  const urlProtetto = fileUrl(videoFileId);
  const info = urlProtetto
    ? { tipo: 'file', fileUrl: urlProtetto, protetto: true }
    : analizzaVideoUrl(videoUrl);

  if (info.tipo === 'assente') {
    return <div className={styles.videoPlaceholder}>{t('corsi.player.noVideo')}</div>;
  }

  if (info.tipo === 'embed') {
    return (
      <>
        <div className={styles.videoWrap}>
          <iframe
            src={info.embedUrl}
            title={titolo || t('corsi.player.videoTitle')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
        {!scaricabile && (
          <div className={styles.downloadRow}>
            <span className={styles.noDownloadNote}>{t('corsi.player.noDownload')}</span>
          </div>
        )}
      </>
    );
  }

  // File video diretto (caricato dal PC oppure URL esterno).
  return (
    <>
      <div className={styles.videoWrap}>
        <video
          src={info.fileUrl}
          controls
          preload="metadata"
          controlsList={scaricabile ? undefined : 'nodownload'}
          onContextMenu={scaricabile ? undefined : (e) => e.preventDefault()}
        />
      </div>
      <div className={styles.downloadRow}>
        {scaricabile ? (
          <a
            className={styles.downloadLink}
            href={info.fileUrl}
            download={info.protetto ? undefined : titolo || undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">⬇</span>
            {t('corsi.player.download')}
          </a>
        ) : (
          <span className={styles.noDownloadNote}>{t('corsi.player.noDownload')}</span>
        )}
      </div>
    </>
  );
};

export default VideoPlayer;
