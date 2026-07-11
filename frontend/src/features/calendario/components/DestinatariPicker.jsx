import { useTranslation } from 'react-i18next';
import SelettoreDestinatario from './SelettoreDestinatario';
import styles from './Calendario.module.css';

/**
 * Raccolta dei DESTINATARI in fase di CREAZIONE evento.
 *
 * Mantiene una lista in memoria (controllata dal form) inviata poi inline con
 * la POST di creazione. Per gli eventi già esistenti i destinatari si gestiscono
 * invece dal dettaglio, tramite gli endpoint dedicati (vedi
 * `EventoDettaglioModal`).
 *
 * `value` è un array di `{ classeId?, utenteId?, etichetta }`.
 */
const DestinatariPicker = ({ value = [], onChange }) => {
  const { t } = useTranslation();

  const aggiungi = ({ classeId, utenteId, etichetta }) => {
    // Evita duplicati sullo stesso bersaglio.
    const esiste = value.some(
      (d) => (classeId && d.classeId === classeId) || (utenteId && d.utenteId === utenteId)
    );
    if (esiste) return;
    onChange([...value, { classeId, utenteId, etichetta }]);
  };

  const rimuovi = (indice) => onChange(value.filter((_, i) => i !== indice));

  return (
    <div className={styles.destinatariBox}>
      <span className={styles.destinatariTitle}>{t('calendario.destinatari.title')}</span>

      {value.length === 0 ? (
        <p className={styles.emptyText}>{t('calendario.destinatari.emptyPicker')}</p>
      ) : (
        <div className={styles.chipsList}>
          {value.map((d, i) => (
            <span key={`${d.classeId || d.utenteId}-${i}`} className={styles.destinatarioChip}>
              {d.classeId ? '👥' : '👤'} {d.etichetta}
              <button
                type="button"
                className={styles.destinatarioRemove}
                onClick={() => rimuovi(i)}
                aria-label={t('common.remove')}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <SelettoreDestinatario onAggiungi={aggiungi} />
    </div>
  );
};

export default DestinatariPicker;
