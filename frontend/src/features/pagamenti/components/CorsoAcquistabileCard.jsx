import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { fileUrl } from '../../../utils/fileUrl';
import styles from './Pagamenti.module.css';

/**
 * Card di un corso ACQUISTABILE nel catalogo. Mostra copertina, titolo,
 * descrizione di vendita, prezzo formattato e l'aula di destinazione. Il
 * pulsante avvia il checkout, oppure è disattivato se lo studente è già
 * iscritto o ha già acquistato il corso.
 */
const CorsoAcquistabileCard = ({ corso, onAcquista, isPending = false }) => {
  const { t } = useTranslation();
  const copertina = fileUrl(corso.copertinaFileId) || corso.copertinaUrl || null;
  const nonAcquistabile = corso.giaIscritto || corso.giaAcquistato;

  const etichettaBottone = corso.giaIscritto
    ? t('pagamenti.catalogo.giaIscritto')
    : corso.giaAcquistato
      ? t('pagamenti.catalogo.giaAcquistato')
      : t('pagamenti.catalogo.acquista');

  return (
    <Card className={styles.card} padding="md">
      {copertina ? (
        <img className={styles.copertina} src={copertina} alt="" loading="lazy" />
      ) : (
        <div className={styles.copertinaPlaceholder} aria-hidden="true">
          {corso.titolo?.slice(0, 1)?.toUpperCase() || '★'}
        </div>
      )}

      <h2 className={styles.cardTitle}>{corso.titolo}</h2>

      <div className={styles.cardMeta}>
        {corso.materia && <Badge tone="neutral">{corso.materia}</Badge>}
        {corso.livello && <Badge tone="neutral">{corso.livello}</Badge>}
      </div>

      {(corso.descrizioneVendita || corso.descrizione) && (
        <p className={styles.cardDesc}>
          {corso.descrizioneVendita || corso.descrizione}
        </p>
      )}

      {corso.aulaDestinazione && (
        <p className={styles.aula}>
          {t('pagamenti.catalogo.aulaDestinazione', {
            aula: corso.aulaDestinazione.nome,
          })}
        </p>
      )}

      <div className={styles.priceRow}>
        <span className={styles.price}>{corso.prezzoFormattato}</span>
      </div>

      <Button
        fullWidth
        disabled={nonAcquistabile || isPending}
        isLoading={isPending}
        onClick={() => onAcquista(corso.id)}
      >
        {etichettaBottone}
      </Button>
    </Card>
  );
};

export default CorsoAcquistabileCard;
