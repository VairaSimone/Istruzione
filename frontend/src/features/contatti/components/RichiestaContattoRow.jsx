import { useTranslation } from 'react-i18next';
import Badge from '../../../components/ui/Badge';
import { formatDateTime } from '../../../utils/datetime';
import styles from './Contatti.module.css';

/**
 * Tono del badge per stato della richiesta.
 *   nuova → seal (in evidenza) · in_gestione → gold · chiusa → matcha · spam → neutral
 */
const TONO_STATO = {
  nuova: 'seal',
  in_gestione: 'gold',
  chiusa: 'matcha',
  spam: 'neutral',
};

/**
 * Riga (cliccabile) di un lead nell'inbox. Puramente presentazionale: mostra
 * mittente, tipo, stato e un'anteprima; delega l'apertura del dettaglio al
 * chiamante. Le richieste ancora "nuova" sono evidenziate.
 */
const RichiestaContattoRow = ({ richiesta, onOpen }) => {
  const { t } = useTranslation();

  return (
    <li>
      <button
        type="button"
        className={[styles.riga, richiesta.stato === 'nuova' ? styles.rigaNonLetta : '']
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpen(richiesta)}
      >
        <span className={styles.rigaInfo}>
          <span className={styles.rigaNome}>
            {richiesta.nome}
            <Badge tone="neutral">{t(`contatti.tipi.${richiesta.tipo}`, { defaultValue: richiesta.tipo })}</Badge>
          </span>
          <span className={styles.rigaMeta}>
            <span>{richiesta.email}</span>
            <span>{formatDateTime(richiesta.created_at)}</span>
          </span>
          {richiesta.messaggio && (
            <span className={styles.rigaAnteprima}>{richiesta.messaggio}</span>
          )}
        </span>
        <span className={styles.rigaBadges}>
          <Badge tone={TONO_STATO[richiesta.stato] ?? 'neutral'}>
            {t(`contatti.stati.${richiesta.stato}`, { defaultValue: richiesta.stato })}
          </Badge>
        </span>
      </button>
    </li>
  );
};

export default RichiestaContattoRow;
