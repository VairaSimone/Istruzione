import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { formatDate } from '../../../utils/datetime';
import { certificatoPdfUrl } from '../../../utils/certificatoUrl';
import { verificaCertificatoPath } from '../../../constants/routes';
import styles from './Certificati.module.css';

/**
 * Scheda di un CERTIFICATO.
 *
 * Mostra lo stato (valido/revocato), lo studente, il percorso, la data e il
 * codice di verifica. Azioni: scarica PDF (endpoint protetto, aperto come
 * navigazione così i cookie viaggiano), apri la verifica pubblica e — solo per
 * lo staff e sui certificati validi — revoca.
 *
 * @param {object}   certificato
 * @param {boolean}  canManage    true per insegnante/admin (mostra «Revoca»)
 * @param {Function} onRevoca     (certificato) => void
 */
const CertificatoCard = ({ certificato, canManage = false, onRevoca }) => {
  const { t, i18n } = useTranslation();
  const revocato = certificato.stato === 'revocato';

  const scaricaPdf = () => {
    const url = certificatoPdfUrl(certificato.id);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{certificato.titolo}</h3>
          <p className={styles.cardStudente}>{certificato.nomeStudente}</p>
        </div>
        <Badge tone={revocato ? 'danger' : 'matcha'}>
          {t(`certificati.stati.${certificato.stato}`)}
        </Badge>
      </div>

      <div className={styles.cardMeta}>
        {certificato.nomeCorso && (
          <span>
            {t('certificati.card.percorso')}: {certificato.nomeCorso}
          </span>
        )}
        {certificato.esito && (
          <span>
            {t('certificati.card.esito')}: {certificato.esito}
          </span>
        )}
        <span>
          {t('certificati.card.dataCompletamento')}:{' '}
          {formatDate(certificato.dataCompletamento, i18n.language)}
        </span>
        <span className={styles.cardCodice}>{certificato.codice}</span>
      </div>

      <div className={styles.cardActions}>
        <Button size="sm" onClick={scaricaPdf}>
          {t('certificati.card.scaricaPdf')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            window.open(verificaCertificatoPath(certificato.codice), '_blank', 'noopener')
          }
        >
          {t('certificati.card.verifica')}
        </Button>
        {canManage && !revocato && onRevoca && (
          <Button size="sm" variant="ghost" onClick={() => onRevoca(certificato)}>
            {t('certificati.card.revoca')}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default CertificatoCard;
