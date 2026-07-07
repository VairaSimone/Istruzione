import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCorsoStudente } from '../hooks/useCorsi';
import { ROUTES } from '../constants/routes';
import { formatDurata } from '../utils/durata';
import VideoPlayer from '../features/corsi/components/VideoPlayer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/corsi/components/Corsi.module.css';

/** Dettaglio corso (studente): capitoli con player video e documenti scaricabili. */
const CorsoStudenteDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: corso, isLoading, isError } = useCorsoStudente(id);

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !corso)
    return <p className={styles.emptyText}>{t('corsi.studente.loadError')}</p>;

  const capitoli = corso.capitoli ?? [];

  return (
    <div>
      <Link to={ROUTES.CORSI_STUDENTE} className={styles.backLink}>
        {t('corsi.studente.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{corso.titolo}</h1>
          {corso.descrizione && (
            <p className={styles.pageSubtitle}>{corso.descrizione}</p>
          )}
          <div className={styles.cardMeta}>
            {corso.livelloJLPT && <Badge tone="neutral">{corso.livelloJLPT}</Badge>}
            <span className={styles.mutedSmall}>
              {t('corsi.card.capitoli', { n: corso.conteggioCapitoli ?? 0 })}
            </span>
          </div>
        </div>
      </div>

      {capitoli.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.studente.noCapitoli')}</p>
      ) : (
        capitoli.map((capitolo, index) => (
          <Card key={capitolo.id} className={styles.playerCapitolo}>
            <h2 className={styles.playerCapitoloTitle}>
              {t('corsi.player.capitoloNum', { num: index + 1 })} · {capitolo.titolo}
              {capitolo.videoDurataSecondi
                ? ` · ${formatDurata(capitolo.videoDurataSecondi)}`
                : ''}
            </h2>
            {capitolo.descrizione && (
              <p className={styles.playerCapitoloDesc}>{capitolo.descrizione}</p>
            )}

            <VideoPlayer
              videoUrl={capitolo.videoUrl}
              scaricabile={capitolo.scaricabileEffettivo}
              titolo={capitolo.titolo}
            />

            {capitolo.documenti && capitolo.documenti.length > 0 && (
              <div className={styles.playerDocs}>
                <span className={styles.documentiTitle}>
                  {t('corsi.documento.title')}
                </span>
                <ul className={styles.documentoList}>
                  {capitolo.documenti.map((doc) => (
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
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
};

export default CorsoStudenteDetailPage;
