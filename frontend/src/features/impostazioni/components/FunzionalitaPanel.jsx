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
 *   3. una sezione dipendente non si accende finché TUTTE le sue dipendenze
 *      sono accese (i pagamenti richiedono corsi E aule).
 *
 * Il catalogo (nome, descrizione, nucleo, dipendenze) arriva da
 * `GET /api/config`: aggiungere una sezione al backend la fa comparire qui
 * senza toccare questo componente.
 */
const FunzionalitaPanel = ({ catalogo = [], valore = {}, onChange }) => {
  const { t } = useTranslation();

  const attiva = (chiave) => valore[chiave] !== false;

  /** Chiavi da cui `chiave` dipende (array, eventualmente vuoto). */
  const dipendenzeDi = (chiave) => DIPENDENZE[chiave] ?? [];

  /** Prima dipendenza SPENTA che blocca `chiave`, o `null` se è libera. */
  const dipendenzaSpenta = (chiave, stato) =>
    dipendenzeDi(chiave).find((richiesta) => stato[richiesta] === false) ?? null;

  const toggle = (voce) => {
    if (voce.nucleo) return;
    const prossimo = { ...valore, [voce.chiave]: !attiva(voce.chiave) };

    // Propagazione: spegnere una dipendenza spegne chi la usa. La stessa cosa
    // la farebbe il backend; anticiparla evita all'utente la sorpresa di
    // salvare "compiti: on" e ritrovarli spenti.
    //
    // Il ciclo `while` (come in `risolviFunzionalita` lato backend) regge anche
    // le catene profonde più di un livello: oggi non ce ne sono, domani basta
    // aggiungere una riga a DIPENDENZE senza toccare questa logica.
    if (prossimo[voce.chiave] === false) {
      let modificato = true;
      while (modificato) {
        modificato = false;
        Object.keys(DIPENDENZE).forEach((dipendente) => {
          if (prossimo[dipendente] === false) return;
          if (dipendenzaSpenta(dipendente, prossimo)) {
            prossimo[dipendente] = false;
            modificato = true;
          }
        });
      }
    }
    onChange(prossimo);
  };

  return (
    <div className={styles.sezioneCorpo}>
      <ul className={styles.toggleList}>
        {catalogo.map((voce) => {
          // Il catalogo del backend porta con sé le proprie `dipendeDa`: sono
          // la fonte di verità. La mappa locale è solo il fallback per il primo
          // render, prima che `/api/config` risponda.
          const richieste = voce.dipendeDa?.length ? voce.dipendeDa : dipendenzeDi(voce.chiave);
          const richiesta = richieste.find((r) => !attiva(r)) ?? null;
          const bloccataDaDipendenza = richiesta !== null;
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
