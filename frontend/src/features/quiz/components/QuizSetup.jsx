import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import ErrorState from '../../../components/shared/ErrorState';
import {
  ALFABETI_QUIZ,
  GRUPPI_KANA,
  ANTEPRIMA_GRUPPO,
  DOMINI_QUIZ,
  LIVELLI_JLPT,
  TIPI_QUIZ_KANJI,
  TIPO_QUIZ_KANJI_DEFAULT,
} from '../../../constants/quizDomain';
import styles from './QuizSetup.module.css';

/**
 * Schermata di configurazione della partita (Kana e Kanji).
 *
 * Un selettore di dominio in testa commuta tra i due insiemi di filtri:
 *   - kana : alfabeto, righe (gojūon), varianti (dakuon/yōon);
 *   - kanji: livello JLPT, tipo di quiz (production/recognition/reading).
 * La modalità a tempo è comune. `onStart(filtri, timerMode)` riceve già il
 * `dominio` corretto e solo i campi pertinenti (nessuna riga selezionata per i
 * kana ⇒ tutte le righe, coerente col backend).
 *
 * @param {(filtri:Object, timerMode:boolean) => void} onStart
 * @param {boolean} isLoading       generazione in corso
 * @param {string|null} errorMessage  errore di generazione (es. pool vuoto)
 */
const QuizSetup = ({ onStart, isLoading = false, errorMessage = null }) => {
  const { t, i18n } = useTranslation();

  const [dominio, setDominio] = useState('kana');

  // Stato dei filtri kana.
  const [alfabeto, setAlfabeto] = useState('hiragana');
  const [gruppiSelezionati, setGruppiSelezionati] = useState(() => new Set());
  const [includiDakuon, setIncludiDakuon] = useState(true);
  const [includiYoon, setIncludiYoon] = useState(true);

  // Stato dei filtri kanji.
  const [livello, setLivello] = useState('N5');
  const [tipoQuiz, setTipoQuiz] = useState(TIPO_QUIZ_KANJI_DEFAULT);

  // Comune.
  const [timerMode, setTimerMode] = useState(false);

  const toggleGruppo = (gruppo) => {
    setGruppiSelezionati((precedenti) => {
      const aggiornati = new Set(precedenti);
      if (aggiornati.has(gruppo)) aggiornati.delete(gruppo);
      else aggiornati.add(gruppo);
      return aggiornati;
    });
  };

  const handleStart = () => {
    if (dominio === 'kanji') {
      onStart(
        {
          dominio: 'kanji',
          livello,
          tipoQuiz,
          // La lingua dei significati segue quella dell'interfaccia; il backend
          // usa l'inglese come fallback quando la glossa IT non è disponibile.
          lingua: i18n.language?.startsWith('en') ? 'en' : 'it',
        },
        timerMode
      );
      return;
    }
    onStart(
      {
        dominio: 'kana',
        alfabeto,
        gruppi: Array.from(gruppiSelezionati), // [] ⇒ tutte le righe
        includiDakuon,
        includiYoon,
      },
      timerMode
    );
  };

  const tutteLeRighe = gruppiSelezionati.size === 0;

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>{t('quiz.setup.title')}</h2>
      <p className={styles.subtitle}>{t('quiz.setup.subtitle')}</p>

      {/* Dominio: Kana | Kanji */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('quiz.setup.domainLegend')}</legend>
        <div className={styles.segmented}>
          {DOMINI_QUIZ.map((dom) => (
            <button
              key={dom}
              type="button"
              className={[styles.segment, dominio === dom ? styles.segmentActive : ''].join(' ')}
              aria-pressed={dominio === dom}
              onClick={() => setDominio(dom)}
            >
              {t(`quiz.domains.${dom}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ─────────────── Filtri KANA ─────────────── */}
      {dominio === 'kana' && (
        <>
          {/* Alfabeto */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('quiz.setup.alphabetLegend')}</legend>
            <div className={styles.segmented}>
              {ALFABETI_QUIZ.map((alf) => (
                <button
                  key={alf}
                  type="button"
                  className={[styles.segment, alfabeto === alf ? styles.segmentActive : ''].join(' ')}
                  aria-pressed={alfabeto === alf}
                  onClick={() => setAlfabeto(alf)}
                >
                  {t(`quiz.alphabets.${alf}`)}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Righe (gruppi) */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('quiz.setup.rowsLegend')}</legend>
            <p className={styles.hint}>
              {tutteLeRighe ? t('quiz.setup.rowsAllHint') : t('quiz.setup.rowsSomeHint')}
            </p>
            <div className={styles.chips}>
              {GRUPPI_KANA.map((gruppo) => {
                const attivo = gruppiSelezionati.has(gruppo);
                return (
                  <button
                    key={gruppo}
                    type="button"
                    className={[styles.chip, attivo ? styles.chipActive : ''].join(' ')}
                    aria-pressed={attivo}
                    onClick={() => toggleGruppo(gruppo)}
                  >
                    <span className={styles.chipKana} aria-hidden="true">
                      {ANTEPRIMA_GRUPPO[gruppo]}
                    </span>
                    <span className={styles.chipLabel}>{t(`quiz.groups.${gruppo}`)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Varianti */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('quiz.setup.variantsLegend')}</legend>
            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={includiDakuon}
                  onChange={(e) => setIncludiDakuon(e.target.checked)}
                />
                <span>{t('quiz.setup.includeDakuon')}</span>
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={includiYoon}
                  onChange={(e) => setIncludiYoon(e.target.checked)}
                />
                <span>{t('quiz.setup.includeYoon')}</span>
              </label>
            </div>
          </fieldset>
        </>
      )}

      {/* ─────────────── Filtri KANJI ─────────────── */}
      {dominio === 'kanji' && (
        <>
          {/* Livello JLPT */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('quiz.setup.levelLegend')}</legend>
            <div className={styles.segmented}>
              {LIVELLI_JLPT.map((liv) => (
                <button
                  key={liv}
                  type="button"
                  className={[styles.segment, livello === liv ? styles.segmentActive : ''].join(' ')}
                  aria-pressed={livello === liv}
                  onClick={() => setLivello(liv)}
                >
                  {liv}
                </button>
              ))}
            </div>
            <p className={styles.hint}>{t('quiz.setup.levelHint')}</p>
          </fieldset>

          {/* Tipo di quiz */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('quiz.setup.kanjiTypeLegend')}</legend>
            <div className={styles.typeGrid}>
              {TIPI_QUIZ_KANJI.map((tipo) => {
                const attivo = tipoQuiz === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    className={[styles.typeCard, attivo ? styles.typeCardActive : ''].join(' ')}
                    aria-pressed={attivo}
                    onClick={() => setTipoQuiz(tipo)}
                  >
                    <span className={styles.typeName}>{t(`quiz.kanjiTypes.${tipo}.label`)}</span>
                    <span className={styles.typeDesc}>{t(`quiz.kanjiTypes.${tipo}.hint`)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}

      {/* Modalità a tempo (comune) */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('quiz.setup.modeLegend')}</legend>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={timerMode}
            onChange={(e) => setTimerMode(e.target.checked)}
          />
          <span>{t('quiz.setup.timerMode')}</span>
        </label>
        <p className={styles.hint}>{t('quiz.setup.timerModeHint')}</p>
      </fieldset>

      {errorMessage && (
        <div className={styles.error}>
          <ErrorState message={errorMessage} />
        </div>
      )}

      <Button size="lg" fullWidth onClick={handleStart} isLoading={isLoading}>
        {t('quiz.setup.start')}
      </Button>
    </Card>
  );
};

export default QuizSetup;
