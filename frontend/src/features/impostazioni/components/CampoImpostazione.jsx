import { useTranslation } from 'react-i18next';
import TextField from '../../../components/ui/TextField';
import Select from '../../../components/ui/Select';
import VocabolarioEditor from './VocabolarioEditor';
import LinkListEditor from './LinkListEditor';
import styles from './Impostazioni.module.css';

/**
 * Rende UN campo delle impostazioni a partire dal suo descrittore di schema.
 *
 * Il descrittore arriva da `GET /api/config/schema` e ha la forma
 * `{ tipo, max?, valori?, default, pubblico }`. Non c'è alcun `switch` sui nomi
 * dei campi: aggiungere `identita.motto` al backend lo fa comparire qui, con il
 * controllo giusto, senza modificare una riga di frontend. È esattamente il
 * motivo per cui lo schema è dichiarativo.
 *
 * Le ETICHETTE restano a carico dell'i18n (`impostazioni.campi.<sezione>.<campo>`),
 * con fallback sul nome tecnico: un campo nuovo appare subito, e la traduzione
 * arriva quando arriva.
 */
const CampoImpostazione = ({ sezione, nome, descrittore, valore, onChange, errore }) => {
  const { t } = useTranslation();

  const label = t(`impostazioni.campi.${sezione}.${nome}`, { defaultValue: nome });
  const hint = t(`impostazioni.hint.${sezione}.${nome}`, { defaultValue: '' }) || undefined;

  const comune = { label, error: errore, hint };

  switch (descrittore.tipo) {
    case 'booleano':
      return (
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={Boolean(valore)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className={styles.checkboxTesto}>
            <span className={styles.campoLabel}>{label}</span>
            {hint && <span className={styles.campoHint}>{hint}</span>}
          </span>
        </label>
      );

    case 'enum':
      return (
        <Select
          {...comune}
          value={valore ?? descrittore.default ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {(descrittore.valori ?? []).map((v) => (
            <option key={v} value={v}>
              {t(`impostazioni.valori.${nome}.${v}`, { defaultValue: v })}
            </option>
          ))}
        </Select>
      );

    case 'colore':
      // Doppio controllo: il selettore nativo per scegliere in fretta, il campo
      // di testo per incollare l'esadecimale esatto del manuale di brand.
      return (
        <div className={styles.coloreField}>
          <TextField
            {...comune}
            value={valore ?? ''}
            placeholder="#4F46E5"
            maxLength={7}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="color"
            className={styles.colorePicker}
            aria-label={label}
            value={/^#[0-9a-fA-F]{6}$/.test(valore ?? '') ? valore : '#000000'}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'vocabolario':
      return (
        <VocabolarioEditor
          label={label}
          descrizione={hint}
          valore={valore ?? []}
          max={descrittore.max}
          onChange={onChange}
        />
      );

    case 'link':
      return (
        <LinkListEditor
          label={label}
          descrizione={hint}
          valore={valore ?? []}
          onChange={onChange}
        />
      );

    case 'email':
      return (
        <TextField
          {...comune}
          type="email"
          value={valore ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'telefono':
      return (
        <TextField
          {...comune}
          type="tel"
          value={valore ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'url':
      return (
        <TextField
          {...comune}
          value={valore ?? ''}
          placeholder="https://…  /assets/logo.svg"
          maxLength={descrittore.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'stringa':
    default:
      return (
        <TextField
          {...comune}
          value={valore ?? ''}
          maxLength={descrittore.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

export default CampoImpostazione;
