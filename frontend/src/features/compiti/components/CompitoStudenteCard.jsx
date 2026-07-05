import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { compitoStudenteDetailPath } from '../../../constants/routes';
import { formatDateTime } from '../../../utils/datetime';
import { STATO_STUDENTE_TONE } from '../statoTone';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Compiti.module.css';

/** Card di un compito nella vista studente. */
const CompitoStudenteCard = ({ compito }) => {
  const { t, i18n } = useTranslation();

  return (
    <Card as={Link} to={compitoStudenteDetailPath(compito.id)} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{compito.titolo}</h3>
        <Badge tone={STATO_STUDENTE_TONE[compito.statoStudente] || 'neutral'}>
          {t(`compiti.statiStudente.${compito.statoStudente}`)}
        </Badge>
      </div>

      <div className={styles.cardMeta}>
        <Badge tone="neutral">{t(`compiti.tipi.${compito.tipoAttivita}`)}</Badge>
        <span className={styles.mutedSmall}>
          {t('compiti.card.scadenza', {
            data: formatDateTime(compito.dataScadenza, i18n.language),
          })}
        </span>
      </div>

      {compito.consegna?.punteggioOttenuto != null && (
        <div className={styles.cardStats}>
          <span>
            {t('compiti.detail.score', {
              punteggio: compito.consegna.punteggioOttenuto,
              max: compito.punteggioMassimo,
            })}
          </span>
        </div>
      )}
    </Card>
  );
};

export default CompitoStudenteCard;
