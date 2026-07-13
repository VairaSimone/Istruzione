import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useUpdateQuiz } from '../../../hooks/useQuizGestione';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import {
  ALFABETI_QUIZ,
  GRUPPI_KANA,
  ANTEPRIMA_GRUPPO,
  LIVELLI_JLPT,
  TIPI_QUIZ_KANJI,
} from '../../../constants/quizDomain';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import styles from './QuizGestione.module.css';

/**
 * Configurazione di un quiz creato da un TEMPLATE.
 *
 * Ogni campo può essere FISSATO dalla scuola o lasciato libero: quando è
 * fissato, lo studente non può sovrascriverlo al momento della partita (il
 * backend applica la precedenza in `risolviFiltri`); quando è libero, il
 * selettore compare nella schermata di setup del quiz.
 *
 * Il blob viene inviato intero a `PATCH /quiz/gestione/:id`: il registro dei
 * template lo valida e scarta le chiavi sconosciute, perciò qui non serve
 * ripulirlo a mano oltre alla rimozione dei campi "liberi".
 */

const LIBERO = ''; // valore del <Select> per «lascia scegliere allo studente»

const ConfigurazioneTemplatePanel = ({ quiz }) => {
  const { t, i18n } = useTranslation();
  const updateQuiz = useUpdateQuiz();
  const codice = quiz.templateCodice;
  const isBanca = typeof codice === 'string' && codice.startsWith('banca-');
  const bancaMeta = quiz.bancaMeta ?? null;

  // Risolutore di campo localizzato { it, en } → stringa nella lingua attiva.
  const loc = (valore) => {
    if (!valore) return '';
    if (typeof valore === 'string') return valore;
    const lingua = i18n.language?.startsWith('en') ? 'en' : 'it';
    return valore[lingua] ?? valore.it ?? valore.en ?? '';
  };

  // Bozza locale della configurazione: si riallinea al server quando il quiz
  // viene rimontato (il chiamante usa `key={quiz.updated_at}`), evitando di
  // sincronizzare stato React con uno `useEffect`.
  const [config, setConfig] = useState(quiz.configurazione ?? {});

  const imposta = (campo, valore) => {
    setConfig((precedente) => {
      const aggiornata = { ...precedente };
      // Un campo "libero" si rappresenta con l'assenza della chiave.
      if (valore === undefined || valore === LIBERO) delete aggiornata[campo];
      else aggiornata[campo] = valore;
      return aggiornata;
    });
  };

  const toggleGruppo = (gruppo) => {
    setConfig((precedente) => {
      const attuali = new Set(precedente.gruppi ?? []);
      if (attuali.has(gruppo)) attuali.delete(gruppo);
      else attuali.add(gruppo);

      const aggiornata = { ...precedente };
      if (attuali.size === 0) delete aggiornata.gruppi;
      else aggiornata.gruppi = Array.from(attuali);
      return aggiornata;
    });
  };

  const toggleSezione = (codiceSezione) => {
    setConfig((precedente) => {
      const attuali = new Set(precedente.sezioni ?? []);
      if (attuali.has(codiceSezione)) attuali.delete(codiceSezione);
      else attuali.add(codiceSezione);

      const aggiornata = { ...precedente };
      // Nessuna sezione ⇒ chiave assente ⇒ tutte le sezioni (comportamento libero).
      if (attuali.size === 0) delete aggiornata.sezioni;
      else aggiornata.sezioni = Array.from(attuali);
      return aggiornata;
    });
  };

  const handleSalva = async () => {
    try {
      await updateQuiz.mutateAsync({ id: quiz.id, configurazione: config });
      toast.success(t('quizGestione.config.saved'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const gruppiFissati = new Set(config.gruppi ?? []);
  const sezioniFissate = new Set(config.sezioni ?? []);

  return (
    <Card>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>{t('quizGestione.config.title')}</h3>
          <p className={styles.mutedSmall}>{t('quizGestione.config.subtitle')}</p>
        </div>
        <Button size="sm" onClick={handleSalva} isLoading={updateQuiz.isPending}>
          {t('common.save')}
        </Button>
      </div>

      {/* ─────────────── Template kana ─────────────── */}
      {codice === 'kana' && (
        <div className={styles.form}>
          <Select
            label={t('quiz.setup.alphabetLegend')}
            value={config.alfabeto ?? LIBERO}
            onChange={(e) => imposta('alfabeto', e.target.value)}
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            {ALFABETI_QUIZ.map((alf) => (
              <option key={alf} value={alf}>
                {t(`quiz.alphabets.${alf}`)}
              </option>
            ))}
          </Select>

          <fieldset>
            <legend className={styles.legend}>{t('quiz.setup.rowsLegend')}</legend>
            <p className={styles.opzioniHint}>
              {gruppiFissati.size === 0
                ? t('quizGestione.config.righeLibere')
                : t('quizGestione.config.righeFissate')}
            </p>
            <div className={styles.configList}>
              {GRUPPI_KANA.map((gruppo) => {
                const attivo = gruppiFissati.has(gruppo);
                return (
                  <button
                    key={gruppo}
                    type="button"
                    className={styles.configChip}
                    aria-pressed={attivo}
                    onClick={() => toggleGruppo(gruppo)}
                    style={attivo ? undefined : { opacity: 0.55 }}
                  >
                    <span aria-hidden="true">{ANTEPRIMA_GRUPPO[gruppo]}</span>
                    <span className={styles.configValue}>{t(`quiz.groups.${gruppo}`)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Select
            label={t('quiz.setup.includeDakuon')}
            value={
              config.includiDakuon === undefined ? LIBERO : String(config.includiDakuon)
            }
            onChange={(e) =>
              imposta(
                'includiDakuon',
                e.target.value === LIBERO ? undefined : e.target.value === 'true'
              )
            }
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            <option value="true">{t('quizGestione.config.si')}</option>
            <option value="false">{t('quizGestione.config.no')}</option>
          </Select>

          <Select
            label={t('quiz.setup.includeYoon')}
            value={config.includiYoon === undefined ? LIBERO : String(config.includiYoon)}
            onChange={(e) =>
              imposta(
                'includiYoon',
                e.target.value === LIBERO ? undefined : e.target.value === 'true'
              )
            }
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            <option value="true">{t('quizGestione.config.si')}</option>
            <option value="false">{t('quizGestione.config.no')}</option>
          </Select>
        </div>
      )}

      {/* ─────────────── Template kanji ─────────────── */}
      {codice === 'kanji' && (
        <div className={styles.form}>
          <Select
            label={t('quiz.setup.levelLegend')}
            value={config.livello ?? LIBERO}
            onChange={(e) => imposta('livello', e.target.value)}
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            {LIVELLI_JLPT.map((liv) => (
              <option key={liv} value={liv}>
                {liv}
              </option>
            ))}
          </Select>

          <Select
            label={t('quiz.setup.kanjiTypeLegend')}
            value={config.tipoQuiz ?? LIBERO}
            onChange={(e) => imposta('tipoQuiz', e.target.value)}
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            {TIPI_QUIZ_KANJI.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t(`quiz.kanjiTypes.${tipo}.label`)}
              </option>
            ))}
          </Select>

          <Select
            label={t('quizGestione.config.lingua')}
            value={config.lingua ?? LIBERO}
            onChange={(e) => imposta('lingua', e.target.value)}
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            <option value="it">{t('language.options.it')}</option>
            <option value="en">{t('language.options.en')}</option>
          </Select>
        </div>
      )}

      {/* ─────────────── Template banca dati ─────────────── */}
      {isBanca && bancaMeta && (
        <div className={styles.form}>
          <Select
            label={t('quizGestione.config.bancaModalita')}
            value={config.modalita ?? LIBERO}
            onChange={(e) => imposta('modalita', e.target.value)}
          >
            <option value={LIBERO}>{t('quizGestione.config.libero')}</option>
            {bancaMeta.modalita.map((m) => (
              <option key={m.codice} value={m.codice}>
                {loc(m.nome)}
              </option>
            ))}
          </Select>

          {bancaMeta.sezioni.length > 1 && (
            <fieldset>
              <legend className={styles.legend}>{t('quizGestione.config.bancaSezioni')}</legend>
              <p className={styles.opzioniHint}>
                {sezioniFissate.size === 0
                  ? t('quizGestione.config.sezioniLibere')
                  : t('quizGestione.config.sezioniFissate')}
              </p>
              <div className={styles.configList}>
                {bancaMeta.sezioni.map((s) => {
                  const attivo = sezioniFissate.has(s.codice);
                  return (
                    <button
                      key={s.codice}
                      type="button"
                      className={styles.configChip}
                      aria-pressed={attivo}
                      onClick={() => toggleSezione(s.codice)}
                      style={attivo ? undefined : { opacity: 0.55 }}
                    >
                      <span className={styles.configValue}>{loc(s.nome)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </Card>
  );
};

export default ConfigurazioneTemplatePanel;
