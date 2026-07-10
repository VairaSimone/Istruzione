import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import styles from './Impostazioni.module.css';

/**
 * Editor della lista di LINK del footer: coppie { etichetta, url }.
 *
 * L'URL accetta sia un indirizzo assoluto `https://…` sia un percorso relativo
 * `/privacy`, esattamente come lo schema del backend: una scuola può linkare
 * una propria pagina interna senza doverla ospitare altrove.
 */
const LinkListEditor = ({ label, descrizione, valore = [], onChange, max = 12 }) => {
  const { t } = useTranslation();
  const link = Array.isArray(valore) ? valore : [];
  const pieno = link.length >= max;

  const aggiorna = (indice, campo, nuovo) => {
    onChange(link.map((l, i) => (i === indice ? { ...l, [campo]: nuovo } : l)));
  };

  const aggiungi = () => {
    if (pieno) return;
    onChange([...link, { etichetta: '', url: '' }]);
  };

  const rimuovi = (indice) => onChange(link.filter((_, i) => i !== indice));

  return (
    <div className={styles.linkList}>
      <span className={styles.campoLabel}>{label}</span>
      {descrizione && <p className={styles.campoHint}>{descrizione}</p>}

      {link.length === 0 && (
        <p className={styles.vocabolarioVuoto}>{t('impostazioni.footer.linkVuoti')}</p>
      )}

      {link.map((voce, indice) => (
        <div key={indice} className={styles.linkRiga}>
          <input
            type="text"
            className={styles.inputInline}
            value={voce.etichetta ?? ''}
            maxLength={60}
            placeholder={t('impostazioni.footer.etichetta')}
            aria-label={t('impostazioni.footer.etichetta')}
            onChange={(e) => aggiorna(indice, 'etichetta', e.target.value)}
          />
          <input
            type="text"
            className={styles.inputInline}
            value={voce.url ?? ''}
            maxLength={2048}
            placeholder="https://… /privacy"
            aria-label={t('impostazioni.footer.url')}
            onChange={(e) => aggiorna(indice, 'url', e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => rimuovi(indice)}
            aria-label={t('common.delete')}
          >
            ×
          </Button>
        </div>
      ))}

      <Button type="button" size="sm" variant="secondary" onClick={aggiungi} disabled={pieno}>
        {t('impostazioni.footer.aggiungiLink')}
      </Button>
    </div>
  );
};

export default LinkListEditor;
