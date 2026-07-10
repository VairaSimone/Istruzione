import { useTranslation } from 'react-i18next';
import { DIPENDENZE } from '../../../constants/funzionalita';
import Badge from '../../../components/ui/Badge';
import styles from './Impostazioni.module.css';

/**
 * Interruttori delle SEZIONI attive per la scuola.
 *
 * Tre regole, tutte imposte anche dal backend — qui le rendiamo visibili
 * invece di lasciare che l'utente scopra un 422:
 *
 *   1. le sezioni di NUCLEO (il profilo) non si spengono: l'interruttore è
 *      bloccato e accanto compare un'etichetta che lo spiega;
 *   2. spegnere una sezione spegne quelle che DIPENDONO da essa (i compiti
 *      vivono nelle aule): l'anteprima si aggiorna subito;
 *   3. una sezione dipendente non si accende finché la sua dipendenza è spenta.
 *
 * Il catalogo (nome, descrizione, nucleo, dipendenze) arriva da
 * `GET /api/config`: aggiungere una sezione al backend la fa comparire qui
 * senza toccare questo componente.
 */
const FunzionalitaPanel = ({ catalogo = [], valore = {}, onChange }) => {
  const { t } = useTranslation();

  const attiva = (chiave) => valore[chiave] !== false;

  const dipendenzaDi = (chiave) => DIPENDENZE[chiave] ?? null;

  const toggle = (voce) => {
    if (voce.nucleo) return;
    const prossimo = { ...valore, [voce.chiave]: !attiva(voce.chiave) };

    // Propagazione: spegnere una dipendenza spegne chi la usa. La stessa cosa
    // la farebbe il backend; anticiparla evita all'utente la sorpresa di
    // salvare "compiti: on" e ritrovarli spenti.
    if (prossimo[voce.chiave] === false) {
      Object.entries(DIPENDENZE).forEach(([dipendente, richiesta]) => {
        if (richiesta === voce.chiave) prossimo[dipendente] = false;
      });
    }
    onChange(prossimo);
  };

  return (
    <div className={styles.sezioneCorpo}>
      <ul className={styles.toggleList}>
        {catalogo.map((voce) => {
          const richiesta = dipendenzaDi(voce.chiave);
          const bloccataDaDipendenza = richiesta ? !attiva(richiesta) : false;
          const disabilitata = voce.nucleo || bloccataDaDipendenza;
          const checked = voce.nucleo ? true : attiva(voce.chiave);

          return (
            <li key={voce.chiave} className={styles.toggleRiga}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={checked}
                  disabled={disabilitata}
                  onChange={() => toggle(voce)}
                />
                <span className={styles.toggleTesto}>
                  <span className={styles.toggleTitolo}>
                    {t(`funzionalita.${voce.chiave}.nome`, { defaultValue: voce.nome })}
                    {voce.nucleo && (
                      <Badge tone="neutral">{t('impostazioni.funzionalita.nucleo')}</Badge>
                    )}
                  </span>
                  <span className={styles.toggleDescrizione}>
                    {t(`funzionalita.${voce.chiave}.descrizione`, {
                      defaultValue: voce.descrizione,
                    })}
                  </span>
                  {bloccataDaDipendenza && (
                    <span className={styles.toggleAvviso}>
                      {t('impostazioni.funzionalita.dipende', {
                        sezione: t(`funzionalita.${richiesta}.nome`, {
                          defaultValue: richiesta,
                        }),
                      })}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FunzionalitaPanel;
