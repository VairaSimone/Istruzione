import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { compitoDetailPath } from '../../../constants/routes';
import { formatDateTime } from '../../../utils/datetime';
import { STATO_COMPITO_TONE } from '../statoTone';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Compiti.module.css';

/** Card di riepilogo di un compito nella lista docente. */
const CompitoCard = ({ compito }) => {
  const { t, i18n } = useTranslation();
  const { classi = 0, studenti = 0 } = compito.assegnazioni || {};

  return (
    <Card as={Link} to={compitoDetailPath(compito.id)} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{compito.titolo}</h3>
        <Badge tone={STATO_COMPITO_TONE[compito.stato] || 'neutral'}>
          {t(`compiti.stati.${compito.stato}`)}
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

      <div className={styles.cardStats}>
        <span>{t('compiti.card.assegnazioni', { classi, studenti })}</span>
        <span>{t('compiti.card.completati', { n: compito.completati ?? 0 })}</span>
      </div>
    </Card>
  );
};

export default CompitoCard;
