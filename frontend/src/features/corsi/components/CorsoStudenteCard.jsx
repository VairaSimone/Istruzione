import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { corsoStudenteDetailPath } from '../../../constants/routes';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { fileUrl } from '../../../utils/fileUrl';
import styles from './Corsi.module.css';

/** Card di un corso nel catalogo dello studente. */
const CorsoStudenteCard = ({ corso }) => {
  const { t } = useTranslation();
  // Precedenza al file caricato; in mancanza, l'eventuale URL esterno.
  const copertina = fileUrl(corso.copertinaFileId) || corso.copertinaUrl || null;

  return (
    <Card as={Link} to={corsoStudenteDetailPath(corso.id)} className={styles.card}>
      <div className={styles.cover}>
        {copertina ? (
          <img src={copertina} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverFallback} aria-hidden="true">
            日
          </span>
        )}
      </div>

      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{corso.titolo}</h3>
        {corso.livello && <Badge tone="neutral">{corso.livello}</Badge>}
      </div>

      {corso.descrizione && <p className={styles.cardDesc}>{corso.descrizione}</p>}

      <div className={styles.cardStats}>
        <span>{t('corsi.card.capitoli', { n: corso.conteggioCapitoli ?? 0 })}</span>
      </div>
    </Card>
  );
};

export default CorsoStudenteCard;
