import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { messaggioDetailPath } from '../../../constants/routes';
import { formatDateTime } from '../../../utils/datetime';
import { TIPO_MESSAGGIO_TONE } from '../tipoTone';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './Messaggi.module.css';

/**
 * Riga di un messaggio in una lista (inbox, inviati, note).
 * `variant`: 'ricevuto' | 'inviato' | 'nota' — determina il contesto mostrato.
 */
const MessaggioListItem = ({ messaggio, variant = 'ricevuto' }) => {
  const { t, i18n } = useTranslation();

  const nonLetto = variant === 'ricevuto' && messaggio.letto === false;

  const context = () => {
    if (variant === 'ricevuto' && messaggio.mittente) {
      return t('messaggi.from', {
        nome: `${messaggio.mittente.nome} ${messaggio.mittente.cognome}`,
      });
    }
    if (variant === 'inviato' && messaggio.conteggio) {
      return t('messaggi.readCount', {
        letti: messaggio.conteggio.letti,
        tot: messaggio.conteggio.destinatari,
      });
    }
    if (variant === 'nota' && messaggio.notaSu) {
      return t('messaggi.about', {
        nome: `${messaggio.notaSu.nome} ${messaggio.notaSu.cognome}`,
      });
    }
    return '';
  };

  return (
    <Card
      as={Link}
      to={messaggioDetailPath(messaggio.id)}
      className={[styles.item, nonLetto ? styles.itemUnread : ''].join(' ')}
    >
      <div className={styles.itemHead}>
        <span className={styles.itemSubject}>
          {messaggio.oggetto || t('messaggi.noSubject')}
        </span>
        <Badge tone={TIPO_MESSAGGIO_TONE[messaggio.tipo] || 'neutral'}>
          {t(`messaggi.tipi.${messaggio.tipo}`)}
        </Badge>
      </div>
      <p className={styles.itemSnippet}>{messaggio.corpo}</p>
      <div className={styles.itemMeta}>
        <span>{context()}</span>
        <span>{formatDateTime(messaggio.created_at, i18n.language)}</span>
      </div>
    </Card>
  );
};

export default MessaggioListItem;
