import { useTranslation } from 'react-i18next';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './HomepageEditor.module.css';
import impStyles from './Impostazioni.module.css';

/**
 * Editor della sezione HOMEPAGE (campo unico). A differenza delle sezioni
 * generiche, la homepage ha una forma annidata (hero, elenco di sezioni, form,
 * SEO): merita un editor dedicato. Il backend la tratta come `social`/
 * `funzionalita`, cioè sostituita per intero al salvataggio, quindi qui
 * lavoriamo SEMPRE sull'oggetto completo e lo restituiamo tutto a ogni modifica.
 *
 * Le liste di valori (`tipoAzione`, `tipiRichiesta`) arrivano dal blueprint
 * dello schema (`descrittore.forma`), così restano allineate al backend senza
 * essere cablate qui.
 *
 * @param {object} valore       blob homepage completo (default già applicati)
 * @param {object} descrittore  descrittore di schema della sezione (con `forma`)
 * @param {(v:object)=>void} onChange
 */
const HomepageEditor = ({ valore, descrittore, onChange }) => {
  const { t } = useTranslation();

  const homepage = valore ?? {};
  const hero = homepage.hero ?? {};
  const sezioni = Array.isArray(homepage.sezioni) ? homepage.sezioni : [];
  const form = homepage.form ?? {};
  const seo = homepage.seo ?? {};

  const forma = descrittore?.forma ?? {};
  const azioniHero = forma.hero?.tipoAzione?.valori ?? ['iscriviti', 'contatti', 'accedi', 'nessuna'];
  const tipiRichiesta = forma.form?.tipiRichiesta?.valori ?? ['informazioni', 'iscrizione', 'contatto'];
  const maxSezioni = forma.sezioni?.max ?? 12;

  // Aggiornamenti immutabili: si ricompone sempre l'oggetto completo.
  const set = (patch) => onChange({ ...homepage, ...patch });
  const setHero = (patch) => set({ hero: { ...hero, ...patch } });
  const setForm = (patch) => set({ form: { ...form, ...patch } });
  const setSeo = (patch) => set({ seo: { ...seo, ...patch } });

  // `null` sui campi svuotati: coerente con la convenzione del backend.
  const val = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

  const setSezione = (i, patch) => {
    const nuove = sezioni.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    set({ sezioni: nuove });
  };
  const aggiungiSezione = () => {
    if (sezioni.length >= maxSezioni) return;
    set({ sezioni: [...sezioni, { titolo: null, testo: null, immagineUrl: null }] });
  };
  const rimuoviSezione = (i) => set({ sezioni: sezioni.filter((_, idx) => idx !== i) });
  const spostaSezione = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= sezioni.length) return;
    const nuove = [...sezioni];
    [nuove[i], nuove[j]] = [nuove[j], nuove[i]];
    set({ sezioni: nuove });
  };

  const toggleTipoRichiesta = (tipo) => {
    const correnti = Array.isArray(form.tipiRichiesta) ? form.tipiRichiesta : [];
    const nuovi = correnti.includes(tipo)
      ? correnti.filter((v) => v !== tipo)
      : [...correnti, tipo];
    setForm({ tipiRichiesta: nuovi });
  };

  const formTipi = Array.isArray(form.tipiRichiesta) ? form.tipiRichiesta : [];

  return (
    <div className={styles.editor}>
      {/* Attivazione */}
      <label className={impStyles.checkboxField}>
        <input
          type="checkbox"
          checked={Boolean(homepage.attiva)}
          onChange={(e) => set({ attiva: e.target.checked })}
        />
        <span className={impStyles.checkboxTesto}>
          <span className={impStyles.campoLabel}>{t('impostazioni.homepage.attiva.label')}</span>
          <span className={impStyles.campoHint}>{t('impostazioni.homepage.attiva.hint')}</span>
        </span>
      </label>

      {/* Hero */}
      <fieldset className={styles.gruppo}>
        <legend className={styles.gruppoTitolo}>{t('impostazioni.homepage.hero.titolo')}</legend>
        <div className={impStyles.griglia}>
          <TextField
            label={t('impostazioni.homepage.hero.campoTitolo')}
            value={hero.titolo ?? ''}
            maxLength={200}
            onChange={(e) => setHero({ titolo: val(e.target.value) })}
          />
          <TextField
            label={t('impostazioni.homepage.hero.sottotitolo')}
            value={hero.sottotitolo ?? ''}
            maxLength={200}
            onChange={(e) => setHero({ sottotitolo: val(e.target.value) })}
          />
          <TextField
            label={t('impostazioni.homepage.hero.immagineUrl')}
            value={hero.immagineUrl ?? ''}
            placeholder="https://…  /assets/hero.jpg"
            onChange={(e) => setHero({ immagineUrl: val(e.target.value) })}
          />
          <TextField
            label={t('impostazioni.homepage.hero.testoAzione')}
            value={hero.testoAzione ?? ''}
            maxLength={60}
            onChange={(e) => setHero({ testoAzione: val(e.target.value) })}
          />
          <Select
            label={t('impostazioni.homepage.hero.tipoAzione')}
            value={hero.tipoAzione ?? 'contatti'}
            onChange={(e) => setHero({ tipoAzione: e.target.value })}
          >
            {azioniHero.map((a) => (
              <option key={a} value={a}>
                {t(`impostazioni.homepage.azioni.${a}`, { defaultValue: a })}
              </option>
            ))}
          </Select>
        </div>
      </fieldset>

      {/* Sezioni descrittive */}
      <fieldset className={styles.gruppo}>
        <legend className={styles.gruppoTitolo}>{t('impostazioni.homepage.sezioni.titolo')}</legend>
        <p className={impStyles.campoHint}>{t('impostazioni.homepage.sezioni.hint')}</p>

        {sezioni.length === 0 && (
          <p className={styles.vuoto}>{t('impostazioni.homepage.sezioni.vuoto')}</p>
        )}

        {sezioni.map((sez, i) => (
          <div key={i} className={styles.sezioneRiga}>
            <div className={styles.sezioneHead}>
              <span className={styles.sezioneNum}>{i + 1}</span>
              <div className={styles.sezioneAzioni}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => spostaSezione(i, -1)}
                  disabled={i === 0}
                  aria-label={t('impostazioni.homepage.sezioni.su')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => spostaSezione(i, 1)}
                  disabled={i === sezioni.length - 1}
                  aria-label={t('impostazioni.homepage.sezioni.giu')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.iconBtnDanger}
                  onClick={() => rimuoviSezione(i)}
                  aria-label={t('impostazioni.homepage.sezioni.rimuovi')}
                >
                  ×
                </button>
              </div>
            </div>
            <TextField
              label={t('impostazioni.homepage.sezioni.campoTitolo')}
              value={sez.titolo ?? ''}
              maxLength={200}
              onChange={(e) => setSezione(i, { titolo: val(e.target.value) })}
            />
            <TextArea
              label={t('impostazioni.homepage.sezioni.campoTesto')}
              rows={3}
              value={sez.testo ?? ''}
              maxLength={4000}
              onChange={(e) => setSezione(i, { testo: val(e.target.value) })}
            />
            <TextField
              label={t('impostazioni.homepage.sezioni.campoImmagine')}
              value={sez.immagineUrl ?? ''}
              placeholder="https://…  /assets/sezione.jpg"
              onChange={(e) => setSezione(i, { immagineUrl: val(e.target.value) })}
            />
          </div>
        ))}

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={aggiungiSezione}
          disabled={sezioni.length >= maxSezioni}
        >
          {t('impostazioni.homepage.sezioni.aggiungi')}
        </Button>
      </fieldset>

      {/* Form di contatto */}
      <fieldset className={styles.gruppo}>
        <legend className={styles.gruppoTitolo}>{t('impostazioni.homepage.form.titolo')}</legend>

        <label className={impStyles.checkboxField}>
          <input
            type="checkbox"
            checked={form.abilitato !== false}
            onChange={(e) => setForm({ abilitato: e.target.checked })}
          />
          <span className={impStyles.checkboxTesto}>
            <span className={impStyles.campoLabel}>{t('impostazioni.homepage.form.abilitato')}</span>
            <span className={impStyles.campoHint}>{t('impostazioni.homepage.form.abilitatoHint')}</span>
          </span>
        </label>

        <div className={styles.tipiRichiesta}>
          <span className={impStyles.campoLabel}>{t('impostazioni.homepage.form.tipiRichiesta')}</span>
          <div className={styles.tipiLista}>
            {tipiRichiesta.map((tipo) => (
              <label key={tipo} className={styles.tipoChip}>
                <input
                  type="checkbox"
                  checked={formTipi.includes(tipo)}
                  onChange={() => toggleTipoRichiesta(tipo)}
                />
                <span>{t(`contatti.tipi.${tipo}`, { defaultValue: tipo })}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={impStyles.griglia}>
          <TextField
            label={t('impostazioni.homepage.form.emailDestinazione')}
            type="email"
            value={form.emailDestinazione ?? ''}
            hint={t('impostazioni.homepage.form.emailDestinazioneHint')}
            onChange={(e) => setForm({ emailDestinazione: val(e.target.value) })}
          />
        </div>
        <TextArea
          label={t('impostazioni.homepage.form.messaggioConferma')}
          rows={2}
          value={form.messaggioConferma ?? ''}
          maxLength={500}
          hint={t('impostazioni.homepage.form.messaggioConfermaHint')}
          onChange={(e) => setForm({ messaggioConferma: val(e.target.value) })}
        />
      </fieldset>

      {/* SEO */}
      <fieldset className={styles.gruppo}>
        <legend className={styles.gruppoTitolo}>{t('impostazioni.homepage.seo.titolo')}</legend>
        <div className={impStyles.griglia}>
          <TextField
            label={t('impostazioni.homepage.seo.campoTitolo')}
            value={seo.titolo ?? ''}
            maxLength={70}
            onChange={(e) => setSeo({ titolo: val(e.target.value) })}
          />
          <TextField
            label={t('impostazioni.homepage.seo.descrizione')}
            value={seo.descrizione ?? ''}
            maxLength={200}
            onChange={(e) => setSeo({ descrizione: val(e.target.value) })}
          />
        </div>
      </fieldset>
    </div>
  );
};

export default HomepageEditor;
