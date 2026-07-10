import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aulaDetailPath } from '../../../constants/routes';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Aule.module.css';

/**
 * Card di riepilogo di un'aula nella lista: nome, livello, anno, conteggio
 * membri. L'intera card è un link al dettaglio.
 */
const AulaCard = ({ aula }) => {
  const { t } = useTranslation();
  const { insegnanti = 0, studenti = 0 } = aula.conteggio || {};

  return (
    <Card
      as={Link}
      to={aulaDetailPath(aula.id)}
      className={styles.card}
      style={{ '--aula-color': aula.colore || 'var(--color-border-strong)' }}
    >
      <div className={styles.cardHead}>
        <span
          className={styles.colorDot}
          style={{ backgroundColor: aula.colore || 'var(--color-border-strong)' }}
          aria-hidden="true"
        />
        <h3 className={styles.cardTitle}>{aula.nome}</h3>
        {aula.archiviata && <Badge tone="neutral">{t('aule.archived')}</Badge>}
      </div>

      {aula.descrizione && <p className={styles.cardText}>{aula.descrizione}</p>}

      <div className={styles.cardMeta}>
        {aula.livello && <Badge tone="matcha">{aula.livello}</Badge>}
        {aula.annoScolastico && <Badge tone="gold">{aula.annoScolastico}</Badge>}
      </div>

      <div className={styles.cardStats}>
        <span>{t('aule.card.studenti', { n: studenti })}</span>
        <span>{t('aule.card.insegnanti', { n: insegnanti })}</span>
      </div>
    </Card>
  );
};

export default AulaCard;
