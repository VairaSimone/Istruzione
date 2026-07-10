import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import styles from './Impostazioni.module.css';

/**
 * Editor di un VOCABOLARIO didattico (classi, livelli, materie).
 *
 * Una lista di voci libere: la scuola scrive le proprie. Lasciarla vuota è una
 * scelta legittima e significa «campo a testo libero» nei form — non un errore
 * da correggere. Lo diciamo esplicitamente sotto il campo, perché è
 * controintuitivo.
 *
 * @param {string[]} valore
 * @param {(voci: string[]) => void} onChange
 * @param {number} max numero massimo di voci ammesse dal backend
 */
const VocabolarioEditor = ({ label, descrizione, valore = [], onChange, max = 60 }) => {
  const { t } = useTranslation();
  const [bozza, setBozza] = useState('');

  const voci = Array.isArray(valore) ? valore : [];
  const pieno = voci.length >= max;

  const aggiungi = () => {
    const voce = bozza.trim();
    if (!voce || pieno) return;
    // Confronto senza distinzione di maiuscole: "Prima" e "prima" sono la stessa
    // classe, e un duplicato in un <select> è solo confusione.
    if (voci.some((v) => v.toLowerCase() === voce.toLowerCase())) {
      setBozza('');
      return;
    }
    onChange([...voci, voce]);
    setBozza('');
  };

  const rimuovi = (voce) => onChange(voci.filter((v) => v !== voce));

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Dentro un form, Invio invierebbe tutto: qui aggiunge la voce.
      e.preventDefault();
      aggiungi();
    }
  };

  return (
    <div className={styles.vocabolario}>
      <span className={styles.campoLabel}>{label}</span>
      {descrizione && <p className={styles.campoHint}>{descrizione}</p>}

      {voci.length > 0 ? (
        <ul className={styles.chipList}>
          {voci.map((voce) => (
            <li key={voce} className={styles.chip}>
              <span>{voce}</span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => rimuovi(voce)}
                aria-label={t('impostazioni.vocabolario.rimuovi', { voce })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.vocabolarioVuoto}>{t('impostazioni.vocabolario.vuoto')}</p>
      )}

      <div className={styles.vocabolarioRiga}>
        <input
          type="text"
          className={styles.inputInline}
          value={bozza}
          maxLength={80}
          disabled={pieno}
          placeholder={t('impostazioni.vocabolario.placeholder')}
          onChange={(e) => setBozza(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={label}
        />
        <Button type="button" size="sm" variant="secondary" onClick={aggiungi} disabled={pieno}>
          {t('impostazioni.vocabolario.aggiungi')}
        </Button>
      </div>

      {pieno && (
        <p className={styles.campoHint}>{t('impostazioni.vocabolario.pieno', { max })}</p>
      )}
    </div>
  );
};

export default VocabolarioEditor;
