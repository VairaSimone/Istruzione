import { useTranslation } from 'react-i18next';
import { coloreVoce } from '../../../constants/tipiEvento';
import styles from './Calendario.module.css';

/** Estrae "HH:mm" (ora locale) da una data ISO. */
const oraLocale = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Pastiglia compatta di una voce del calendario (evento o scadenza compito).
 * Il colore del bordo sinistro riflette il tipo/colore della voce; l'icona 🎥
 * segnala la presenza di un link di videochiamata.
 */
const VoceChip = ({ voce, onClick }) => {
  const { t } = useTranslation();
  const isCompito = voce.tipoVoce === 'compito';
  const mostraOra = !voce.tuttoIlGiorno && !isCompito;

  const etichettaTipo = isCompito
    ? t('calendario.voce.scadenzaCompito')
    : t(`calendario.tipi.${voce.tipo}`, voce.tipo);

  return (
    <button
      type="button"
      className={[styles.chip, isCompito ? styles.chipCompito : ''].filter(Boolean).join(' ')}
      style={{ '--chip-color': coloreVoce(voce) }}
      onClick={onClick}
      title={`${etichettaTipo} · ${voce.titolo}`}
    >
      {voce.linkVideochiamata && (
        <span className={styles.chipIcon} aria-hidden="true">
          🎥
        </span>
      )}
      {mostraOra && <span className={styles.chipTime}>{oraLocale(voce.dataInizio)}</span>}
      <span className={styles.chipTitle}>{voce.titolo}</span>
    </button>
  );
};

export default VoceChip;
