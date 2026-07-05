import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompitoStudente } from '../hooks/useCompiti';
import { ROUTES } from '../constants/routes';
import { formatDateTime } from '../utils/datetime';
import { STATO_STUDENTE_TONE } from '../features/compiti/statoTone';
import ConsegnaForm from '../features/compiti/components/ConsegnaForm';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/compiti/components/Compiti.module.css';

/** Dettaglio compito (studente): descrizione, scadenza, feedback ricevuto, consegna. */
const CompitoStudenteDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { data: compito, isLoading, isError } = useCompitoStudente(id);

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !compito)
    return <p className={styles.emptyText}>{t('compiti.studente.loadError')}</p>;

  return (
    <div>
      <Link to={ROUTES.COMPITI_STUDENTE} className={styles.backLink}>
        ← {t('compiti.studente.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{compito.titolo}</h1>
          {compito.descrizione && <p className={styles.pageSubtitle}>{compito.descrizione}</p>}
          <div className={styles.cardMeta}>
            <Badge tone={STATO_STUDENTE_TONE[compito.statoStudente] || 'neutral'}>
              {t(`compiti.statiStudente.${compito.statoStudente}`)}
            </Badge>
            <Badge tone="neutral">{t(`compiti.tipi.${compito.tipoAttivita}`)}</Badge>
            <span className={styles.mutedSmall}>
              {t('compiti.card.scadenza', {
                data: formatDateTime(compito.dataScadenza, i18n.language),
              })}
            </span>
          </div>
        </div>
      </div>

      {compito.tempoLimiteMinuti && (
        <p className={styles.mutedSmall}>
          {t('compiti.studente.tempoLimite', { minuti: compito.tempoLimiteMinuti })}
        </p>
      )}

      {compito.consegna?.feedback && (
        <Card>
          <h3 className={styles.panelTitle}>{t('compiti.studente.feedbackTitle')}</h3>
          <p>{compito.consegna.feedback}</p>
        </Card>
      )}

      <ConsegnaForm compito={compito} />
    </div>
  );
};

export default CompitoStudenteDetailPage;
