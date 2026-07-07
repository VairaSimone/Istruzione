import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { corsoDetailPath } from '../../../constants/routes';
import { STATO_CORSO_TONE } from '../statoTone';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Corsi.module.css';

/** Card di riepilogo di un corso nella lista dello staff. */
const CorsoCard = ({ corso }) => {
  const { t } = useTranslation();

  return (
    <Card as={Link} to={corsoDetailPath(corso.id)} className={styles.card}>
      <div className={styles.cover}>
        {corso.copertinaUrl ? (
          <img src={corso.copertinaUrl} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverFallback} aria-hidden="true">
            日
          </span>
        )}
      </div>

      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{corso.titolo}</h3>
        <Badge tone={STATO_CORSO_TONE[corso.stato] || 'neutral'}>
          {t(`corsi.stati.${corso.stato}`)}
        </Badge>
      </div>

      {corso.descrizione && <p className={styles.cardDesc}>{corso.descrizione}</p>}

      <div className={styles.cardMeta}>
        {corso.livelloJLPT && <Badge tone="neutral">{corso.livelloJLPT}</Badge>}
        {corso.videoScaricabile && (
          <Badge tone="matcha">{t('corsi.card.scaricabile')}</Badge>
        )}
      </div>

      <div className={styles.cardStats}>
        <span>{t('corsi.card.capitoli', { n: corso.conteggioCapitoli ?? 0 })}</span>
      </div>
    </Card>
  );
};

export default CorsoCard;
