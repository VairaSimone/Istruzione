import { useTranslation } from 'react-i18next';
import styles from './Corsi.module.css';

/**
 * Riconosce i provider di streaming più comuni (YouTube/Vimeo) e restituisce
 * l'URL di embed; per qualunque altro URL lo tratta come file video diretto.
 *
 * I video sono URL esterni (il progetto non ospita file): per gli embed la
 * possibilità di scaricare è governata dal provider, mentre per i file diretti
 * la applichiamo lato player (attributo `controlsList="nodownload"` e blocco del
 * menu contestuale). Si tratta di un enforcement "di prodotto", coerente con la
 * scelta del backend; un blocco tecnico forte richiederebbe URL firmati/DRM.
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

    return { tipo: 'file', fileUrl: url };
  } catch {
    return { tipo: 'file', fileUrl: url };
  }
};

/**
 * Player di un capitolo.
 * @param {string}  videoUrl
 * @param {boolean} scaricabile  policy di download EFFETTIVA (risolta lato backend)
 * @param {string}  titolo       usato come nome file suggerito per il download
 */
const VideoPlayer = ({ videoUrl, scaricabile, titolo }) => {
  const { t } = useTranslation();
  const info = analizzaVideoUrl(videoUrl);

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

  // File video diretto.
  return (
    <>
      <div className={styles.videoWrap}>
        <video
          src={info.fileUrl}
          controls
          controlsList={scaricabile ? undefined : 'nodownload'}
          onContextMenu={scaricabile ? undefined : (e) => e.preventDefault()}
        />
      </div>
      <div className={styles.downloadRow}>
        {scaricabile ? (
          <a
            className={styles.downloadLink}
            href={info.fileUrl}
            download={titolo || undefined}
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
