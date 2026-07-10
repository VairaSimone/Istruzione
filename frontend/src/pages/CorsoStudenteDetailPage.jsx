import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCorsoStudente } from '../hooks/useCorsi';
import { ROUTES } from '../constants/routes';
import { formatDurata } from '../utils/durata';
import { fileUrl, formatBytes } from '../utils/fileUrl';
import VideoPlayer from '../features/corsi/components/VideoPlayer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/corsi/components/Corsi.module.css';

/** Elenco dei documenti allegati a un capitolo (file caricato oppure URL esterno). */
const DocumentiCapitolo = ({ documenti }) => {
  const { t } = useTranslation();
  if (!documenti || documenti.length === 0) return null;

  return (
    <div className={styles.playerDocs}>
      <span className={styles.documentiTitle}>{t('corsi.documento.title')}</span>
      <ul className={styles.documentoList}>
        {documenti.map((doc) => {
          // Precedenza al file caricato; in mancanza, l'URL esterno.
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
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Una lezione: player del video (file caricato o URL esterno) e allegati.
 * `etichetta` è la numerazione gerarchica già calcolata (es. "1.2").
 */
const Lezione = ({ capitolo, etichetta }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.lezione}>
      <h3 className={styles.playerCapitoloTitle}>
        {etichetta} · {capitolo.titolo}
        {capitolo.videoDurataSecondi
          ? ` · ${formatDurata(capitolo.videoDurataSecondi)}`
          : ''}
      </h3>
      {capitolo.descrizione && (
        <p className={styles.playerCapitoloDesc}>{capitolo.descrizione}</p>
      )}

      <VideoPlayer
        videoFileId={capitolo.videoFileId}
        videoUrl={capitolo.videoUrl}
        scaricabile={capitolo.scaricabileEffettivo}
        titolo={capitolo.titolo}
      />

      <DocumentiCapitolo documenti={capitolo.documenti} />
      {!capitolo.videoFileId && !capitolo.videoUrl && !capitolo.documenti?.length && (
        <p className={styles.emptyText}>{t('corsi.studente.lezioneVuota')}</p>
      )}
    </div>
  );
};

/**
 * Dettaglio corso (studente).
 *
 * Il backend restituisce un albero a DUE livelli: le SEZIONI di primo livello,
 * ognuna con i propri `sottoCapitoli` (le lezioni, stile Udemy). Una sezione può
 * a sua volta avere un video/allegati propri: in tal caso è resa come lezione.
 */
const CorsoStudenteDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: corso, isLoading, isError } = useCorsoStudente(id);

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !corso)
    return <p className={styles.emptyText}>{t('corsi.studente.loadError')}</p>;

  const sezioni = corso.capitoli ?? [];
  const copertina = fileUrl(corso.copertinaFileId) || corso.copertinaUrl || null;

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
            {corso.materia && <Badge tone="gold">{corso.materia}</Badge>}
            {corso.livello && <Badge tone="neutral">{corso.livello}</Badge>}
            <span className={styles.mutedSmall}>
              {t('corsi.card.capitoli', { n: corso.conteggioCapitoli ?? 0 })}
            </span>
          </div>
        </div>
      </div>

      {copertina && (
        <div className={styles.detailCover}>
          <img src={copertina} alt="" loading="lazy" />
        </div>
      )}

      {sezioni.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.studente.noCapitoli')}</p>
      ) : (
        sezioni.map((sezione, indiceSezione) => {
          const sottoCapitoli = sezione.sottoCapitoli ?? [];
          const numeroSezione = indiceSezione + 1;
          // Una sezione con contenuti propri è anche una lezione a sé.
          const sezioneHaContenuti =
            Boolean(sezione.videoFileId || sezione.videoUrl) ||
            (sezione.documenti?.length ?? 0) > 0;

          return (
            <Card key={sezione.id} className={styles.playerCapitolo}>
              <div className={styles.sezioneHead}>
                <h2 className={styles.sezioneTitle}>
                  {t('corsi.player.sezioneNum', { num: numeroSezione })} ·{' '}
                  {sezione.titolo}
                </h2>
                <span className={styles.mutedSmall}>
                  {t('corsi.player.lezioniCount', { n: sottoCapitoli.length })}
                </span>
              </div>

              {sezione.descrizione && (
                <p className={styles.playerCapitoloDesc}>{sezione.descrizione}</p>
              )}

              {sezioneHaContenuti && (
                <Lezione capitolo={sezione} etichetta={`${numeroSezione}`} />
              )}

              {sottoCapitoli.map((lezione, indiceLezione) => (
                <Lezione
                  key={lezione.id}
                  capitolo={lezione}
                  etichetta={`${numeroSezione}.${indiceLezione + 1}`}
                />
              ))}

              {!sezioneHaContenuti && sottoCapitoli.length === 0 && (
                <p className={styles.emptyText}>{t('corsi.studente.sezioneVuota')}</p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};

export default CorsoStudenteDetailPage;
