import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import ErrorState from '../../../components/shared/ErrorState';
import { ALFABETI_QUIZ, GRUPPI_KANA, ANTEPRIMA_GRUPPO } from '../../../constants/quizDomain';
import styles from './QuizSetup.module.css';

/**
 * Schermata di configurazione della partita.
 * Raccoglie i filtri di gioco e li passa a `onStart`. Nessuna riga selezionata
 * ⇒ tutte le righe (coerente col backend: `gruppi` vuoto = tutto).
 *
 * @param {(filtri:Object, timerMode:boolean) => void} onStart
 * @param {boolean} isLoading       generazione in corso
 * @param {string|null} errorMessage  errore di generazione (es. pool vuoto)
 */
const QuizSetup = ({ onStart, isLoading = false, errorMessage = null }) => {
  const { t } = useTranslation();

  const [alfabeto, setAlfabeto] = useState('hiragana');
  const [gruppiSelezionati, setGruppiSelezionati] = useState(() => new Set());
  const [includiDakuon, setIncludiDakuon] = useState(true);
  const [includiYoon, setIncludiYoon] = useState(true);
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
    onStart(
      {
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

      {/* Modalità a tempo */}
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
