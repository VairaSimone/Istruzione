import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import CertificatoRisorsaUpload from './CertificatoRisorsaUpload';
import styles from './Certificati.module.css';

/**
 * Pannello di PERSONALIZZAZIONE del modello di certificato della scuola.
 *
 * Vive nella pagina «Impostazioni scuola», dove sostituisce la resa generica
 * della sezione `certificato` con affordance dedicate: area di testo per il
 * corpo con i segnaposto inseribili, selettori di colore, orientamento del
 * foglio e caricamento di logo/firma.
 *
 * È CONTROLLATO: riceve l'intero oggetto `valore` (già con i default applicati)
 * e ad ogni modifica emette l'oggetto aggiornato via `onChange`. La pagina lo
 * tratta come una sezione delle impostazioni e lo salva con il consueto merge.
 *
 * @param {object}   valore   sezione `certificato` risolta
 * @param {Function} onChange (nuovoValore) => void
 */
const SEGNAPOSTI = ['studente', 'corso', 'scuola', 'data', 'esito', 'firmatario'];

const COLORI = [
  { campo: 'coloreTitolo', fallback: '#1F2937' },
  { campo: 'coloreTesto', fallback: '#374151' },
  { campo: 'coloreBordo', fallback: '#4F46E5' },
  { campo: 'coloreSfondo', fallback: '#FFFFFF' },
];

const ORIENTAMENTI = ['orizzontale', 'verticale'];

const CertificatoConfigPanel = ({ valore = {}, onChange }) => {
  const { t } = useTranslation();

  const set = (campo, v) => onChange?.({ ...valore, [campo]: v });

  const inserisciSegnaposto = (chiave) => {
    const corrente = valore.testoCorpo ?? '';
    const separatore = corrente && !corrente.endsWith(' ') ? ' ' : '';
    set('testoCorpo', `${corrente}${separatore}{{${chiave}}}`);
  };

  const campoColore = ({ campo, fallback }) => (
    <div key={campo} className={styles.coloreField}>
      <TextField
        label={t(`certificati.config.campi.${campo}`)}
        value={valore[campo] ?? ''}
        placeholder={fallback}
        maxLength={7}
        onChange={(e) => set(campo, e.target.value)}
      />
      <input
        type="color"
        className={styles.colorePicker}
        aria-label={t(`certificati.config.campi.${campo}`)}
        value={/^#[0-9a-fA-F]{6}$/.test(valore[campo] ?? '') ? valore[campo] : fallback}
        onChange={(e) => set(campo, e.target.value)}
      />
    </div>
  );

  return (
    <Card>
      <div className={styles.configPanel}>
        <div>
          <h2 className={styles.sezioneTitolo}>{t('certificati.config.title')}</h2>
          <p className={styles.sezioneDescr}>{t('certificati.config.subtitle')}</p>
        </div>

        {/* ── Testi ── */}
        <div className={styles.gruppo}>
          <h3 className={styles.gruppoTitolo}>{t('certificati.config.gruppoTesti')}</h3>

          <TextField
            label={t('certificati.config.campi.titolo')}
            value={valore.titolo ?? ''}
            maxLength={160}
            onChange={(e) => set('titolo', e.target.value)}
          />
          <TextField
            label={t('certificati.config.campi.sottotitolo')}
            value={valore.sottotitolo ?? ''}
            maxLength={200}
            onChange={(e) => set('sottotitolo', e.target.value)}
          />

          <TextArea
            label={t('certificati.config.campi.testoCorpo')}
            hint={t('certificati.config.testoCorpoHint')}
            rows={4}
            value={valore.testoCorpo ?? ''}
            maxLength={1500}
            onChange={(e) => set('testoCorpo', e.target.value)}
          />
          <div className={styles.segnaposti}>
            {SEGNAPOSTI.map((chiave) => (
              <button
                key={chiave}
                type="button"
                className={styles.segnaposto}
                onClick={() => inserisciSegnaposto(chiave)}
              >
                {`{{${chiave}}}`}
              </button>
            ))}
          </div>

          <div className={styles.formRow}>
            <TextField
              label={t('certificati.config.campi.firmatarioNome')}
              value={valore.firmatarioNome ?? ''}
              maxLength={160}
              onChange={(e) => set('firmatarioNome', e.target.value)}
            />
            <TextField
              label={t('certificati.config.campi.firmatarioTitolo')}
              value={valore.firmatarioTitolo ?? ''}
              maxLength={60}
              onChange={(e) => set('firmatarioTitolo', e.target.value)}
            />
          </div>

          <TextField
            label={t('certificati.config.campi.piePagina')}
            value={valore.piePagina ?? ''}
            maxLength={1000}
            onChange={(e) => set('piePagina', e.target.value)}
          />
        </div>

        {/* ── Aspetto ── */}
        <div className={styles.gruppo}>
          <h3 className={styles.gruppoTitolo}>{t('certificati.config.gruppoAspetto')}</h3>

          <div className={styles.colori}>{COLORI.map(campoColore)}</div>

          <div className={styles.formRow}>
            <Select
              label={t('certificati.config.campi.orientamento')}
              value={valore.orientamento ?? 'orizzontale'}
              onChange={(e) => set('orientamento', e.target.value)}
            >
              {ORIENTAMENTI.map((o) => (
                <option key={o} value={o}>
                  {t(`certificati.config.orientamenti.${o}`)}
                </option>
              ))}
            </Select>
          </div>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={valore.mostraCodiceVerifica !== false}
              onChange={(e) => set('mostraCodiceVerifica', e.target.checked)}
            />
            <span className={styles.checkboxTesto}>
              <span className={styles.checkboxLabel}>
                {t('certificati.config.campi.mostraCodiceVerifica')}
              </span>
              <span className={styles.checkboxHint}>
                {t('certificati.config.mostraCodiceHint')}
              </span>
            </span>
          </label>
        </div>

        {/* ── Immagini ── */}
        <div className={styles.gruppo}>
          <h3 className={styles.gruppoTitolo}>{t('certificati.config.gruppoImmagini')}</h3>
          <div className={styles.risorse}>
            <CertificatoRisorsaUpload
              fileId={valore.logoFileId ?? null}
              onChange={(id) => set('logoFileId', id)}
              label={t('certificati.config.campi.logo')}
              hint={t('certificati.config.immagineHint')}
            />
            <CertificatoRisorsaUpload
              fileId={valore.firmaFileId ?? null}
              onChange={(id) => set('firmaFileId', id)}
              label={t('certificati.config.campi.firma')}
              hint={t('certificati.config.immagineHint')}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CertificatoConfigPanel;
