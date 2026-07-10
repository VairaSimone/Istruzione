import { useTranslation } from 'react-i18next';
import { useVocabolario } from '../../hooks/useImpostazioniScuola';
import TextField from './TextField';
import styles from './TextField.module.css';

/**
 * FILTRO su un campo governato da un vocabolario di scuola.
 *
 * Gemello di `VocabolarioField`, ma pensato per le barre dei filtri:
 *
 *   - vocabolario VALORIZZATO → <select> con una voce «tutti» SELEZIONABILE
 *     (a differenza del form, dove il placeholder è disabilitato: lì il vuoto
 *     significa «non ho scelto», qui significa «non filtrare»);
 *   - vocabolario VUOTO → campo di testo, per cercare un livello o una materia
 *     digitandone il nome.
 *
 * Gli studenti non ricevono le impostazioni della propria scuola (sono riservate
 * allo staff): per loro il filtro è sempre a testo libero. È un compromesso
 * consapevole — esporre i vocabolari a tutti gli utenti autenticati, solo per
 * riempire un menu a tendina, non vale l'ampliamento della superficie pubblica.
 *
 * Componente CONTROLLATO: `onChange` riceve direttamente il valore, non l'evento.
 */
const FiltroVocabolario = ({ vocabolario, label, placeholder, value, onChange }) => {
  const { t } = useTranslation();
  const voci = useVocabolario(vocabolario);

  if (voci.length === 0) {
    return (
      <TextField
        label={label}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || t('common.all')}</option>
        {voci.map((voce) => (
          <option key={voce} value={voce}>
            {voce}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FiltroVocabolario;
