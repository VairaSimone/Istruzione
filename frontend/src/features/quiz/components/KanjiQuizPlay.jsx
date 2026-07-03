import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import PronunciationButton from '../../../components/ui/PronunciationButton';
import { TIMER_SECONDI, COMBO_SOGLIA } from '../../../constants/quizDomain';
import styles from './KanjiQuizPlay.module.css';

/**
 * Schermata di gioco del Quiz Kanji. Gemella di `QuizPlay` (kana) ma con tre
 * tipologie di domanda preparate dal backend:
 *
 *   - recognition: kanji → si sceglie il SIGNIFICATO (4 opzioni, `indiceCorretto`);
 *   - reading    : kanji + tipo di lettura → si sceglie la LETTURA (4 opzioni);
 *   - production : si mostra significato/letture, si richiama il kanji a memoria,
 *                  si rivela e ci si AUTOVALUTA (lo sapevo / non lo sapevo).
 *
 * La correttezza è calcolata qui (indice scelto vs `indiceCorretto`, oppure
 * autovalutazione per la produzione) e accumulata in `risposte`, inviate a
 * `onComplete` come `{ kanji, livelloJLPT, corretto }[]` — la forma attesa dal
 * backend per `dominio='kanji'`.
 *
 * La modalità a tempo si applica alle tipologie a scelta multipla
 * (recognition/reading); la produzione è di natura auto-cadenzata.
 *
 * @param {{dominio:'kanji', livello:string, tipoQuiz:string, totale:number, kanji:Array}} sessione
 * @param {boolean} timerMode
 * @param {(risposte:Array, datiBonus:{maxCombo:number, timerMode:boolean}) => void} onComplete
 */
const KanjiQuizPlay = ({ sessione, timerMode = false, onComplete }) => {
  const { t } = useTranslation();

  const domande = sessione.kanji;
  const totale = domande.length;
  const tipoQuiz = sessione.tipoQuiz;
  const livello = sessione.livello;
  const isProduzione = tipoQuiz === 'production';
  // Il timer ha senso solo per le tipologie a scelta multipla.
  const timerAttivo = timerMode && !isProduzione;

  const [indice, setIndice] = useState(0);
  const [combo, setCombo] = useState(0);
  const [scelta, setScelta] = useState(null); // indice opzione scelto (MC)
  const [rivelato, setRivelato] = useState(false); // produzione: kanji svelato
  const [feedback, setFeedback] = useState(null); // { corretto }
  const [valutando, setValutando] = useState(false);
  const [secondiRimasti, setSecondiRimasti] = useState(TIMER_SECONDI);

  const risposteRef = useRef([]);
  const maxComboRef = useRef(0);
  const avanzamentoRef = useRef(null);

  const corrente = domande[indice];

  // Registra l'esito della domanda corrente e programma l'avanzamento.
  const registra = (corretto, indiceScelto = null) => {
    if (valutando) return;
    setValutando(true);
    if (indiceScelto !== null) setScelta(indiceScelto);

    const nuovaCombo = corretto ? combo + 1 : 0;
    if (nuovaCombo > maxComboRef.current) maxComboRef.current = nuovaCombo;
    setCombo(nuovaCombo);

    risposteRef.current = [
      ...risposteRef.current,
      { kanji: corrente.ideogramma, livelloJLPT: livello, corretto },
    ];
    setFeedback({ corretto });

    avanzamentoRef.current = setTimeout(() => {
      if (indice + 1 >= totale) {
        onComplete(risposteRef.current, {
          maxCombo: maxComboRef.current,
          timerMode,
        });
      } else {
        setIndice((i) => i + 1);
        setScelta(null);
        setRivelato(false);
        setFeedback(null);
        setValutando(false);
        setSecondiRimasti(TIMER_SECONDI);
      }
    }, 1000);
  };

  // Riferimento stabile all'ultima `registra` per il timer.
  const registraRef = useRef(registra);
  useEffect(() => {
    registraRef.current = registra;
  });

  // Countdown della modalità a tempo (solo scelta multipla).
  useEffect(() => {
    if (!timerAttivo || valutando || feedback || secondiRimasti <= 0) return undefined;
    const id = setTimeout(() => setSecondiRimasti((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerAttivo, valutando, feedback, secondiRimasti]);

  // Allo scadere del tempo, marca la domanda come errata (una sola volta).
  useEffect(() => {
    if (timerAttivo && !valutando && !feedback && secondiRimasti === 0) {
      registraRef.current(false);
    }
  }, [timerAttivo, valutando, feedback, secondiRimasti]);

  // Pulizia del timer di avanzamento allo smontaggio.
  useEffect(() => () => clearTimeout(avanzamentoRef.current), []);

  const percentualeAvanzamento = Math.round((indice / totale) * 100);
  const comboAttiva = combo >= COMBO_SOGLIA;

  // Classe dell'opzione dopo la risposta (verde = corretta, rosso = scelta errata).
  const classeOpzione = (i) => {
    if (!feedback) return styles.option;
    if (i === corrente.indiceCorretto) return [styles.option, styles.optionCorrect].join(' ');
    if (i === scelta) return [styles.option, styles.optionWrong].join(' ');
    return [styles.option, styles.optionDim].join(' ');
  };

  return (
    <div className={styles.wrapper}>
      {/* Barra di avanzamento del round */}
      <div className={styles.topBar}>
        <span className={styles.counter}>
          {t('quiz.play.progress', { current: indice + 1, total: totale })}
        </span>
        <span className={styles.levelTag}>{livello}</span>
        {combo > 0 && (
          <span className={[styles.combo, comboAttiva ? styles.comboHot : ''].join(' ')}>
            {t('quiz.play.combo', { count: combo })}
            {comboAttiva && <span className={styles.comboBoost}>{t('quiz.play.comboBoost')}</span>}
          </span>
        )}
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${percentualeAvanzamento}%` }} />
      </div>

      <Card className={styles.stage}>
        {/* Countdown modalità a tempo (scelta multipla) */}
        {timerAttivo && (
          <div className={styles.timer} aria-hidden="true">
            <div
              className={[styles.timerFill, secondiRimasti <= 3 ? styles.timerLow : ''].join(' ')}
              style={{ width: `${(secondiRimasti / TIMER_SECONDI) * 100}%` }}
            />
          </div>
        )}

        {/* ─────────────── RECOGNITION ─────────────── */}
        {tipoQuiz === 'recognition' && (
          <>
            <span className={styles.prompt}>{t('quiz.kanjiPlay.recognitionPrompt')}</span>
            <div
              className={[
                styles.kanji,
                feedback ? (feedback.corretto ? styles.kanjiOk : styles.kanjiWrong) : '',
              ].join(' ')}
            >
              {corrente.ideogramma}
            </div>
            <div className={styles.options}>
              {corrente.opzioni.map((opz, i) => (
                <button
                  key={`${opz}-${i}`}
                  type="button"
                  className={classeOpzione(i)}
                  disabled={valutando}
                  onClick={() => registra(i === corrente.indiceCorretto, i)}
                >
                  {opz}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ─────────────── READING ─────────────── */}
        {tipoQuiz === 'reading' && (
          <>
            <span className={styles.prompt}>
              {t(`quiz.kanjiPlay.readingPrompt.${corrente.contesto?.tipoLettura || 'onYomi'}`)}
            </span>
            <div
              className={[
                styles.kanji,
                feedback ? (feedback.corretto ? styles.kanjiOk : styles.kanjiWrong) : '',
              ].join(' ')}
            >
              {corrente.ideogramma}
            </div>
            <div className={styles.options}>
              {corrente.opzioni.map((opz, i) => (
                <button
                  key={`${opz}-${i}`}
                  type="button"
                  className={[classeOpzione(i), styles.optionReading].join(' ')}
                  disabled={valutando}
                  onClick={() => registra(i === corrente.indiceCorretto, i)}
                >
                  {opz}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ─────────────── PRODUCTION ─────────────── */}
        {tipoQuiz === 'production' && (
          <>
            <span className={styles.prompt}>{t('quiz.kanjiPlay.productionPrompt')}</span>

            {/* Indizio: significati + letture (il kanji resta nascosto) */}
            <div className={styles.cue}>
              <div className={styles.cueMeanings}>
                {(corrente.significati || []).join(', ')}
              </div>
              <div className={styles.cueReadings}>
                {corrente.onYomi?.length > 0 && (
                  <span className={styles.cueReadingGroup}>
                    <span className={styles.cueReadingLabel}>{t('quiz.kanjiPlay.onYomi')}</span>
                    {corrente.onYomi.join('・')}
                  </span>
                )}
                {corrente.kunYomi?.length > 0 && (
                  <span className={styles.cueReadingGroup}>
                    <span className={styles.cueReadingLabel}>{t('quiz.kanjiPlay.kunYomi')}</span>
                    {corrente.kunYomi.join('・')}
                  </span>
                )}
              </div>
            </div>

            {!rivelato ? (
              <Button size="lg" onClick={() => setRivelato(true)} disabled={valutando}>
                {t('quiz.kanjiPlay.reveal')}
              </Button>
            ) : (
              <>
                <div
                  className={[
                    styles.kanji,
                    feedback ? (feedback.corretto ? styles.kanjiOk : styles.kanjiWrong) : '',
                  ].join(' ')}
                >
                  {corrente.ideogramma}
                  <PronunciationButton
                    testo={corrente.ideogramma}
                    label={corrente.ideogramma}
                    size="sm"
                  />
                </div>
                {typeof corrente.tratti === 'number' && (
                  <span className={styles.strokeCount}>
                    {t('quiz.kanjiPlay.strokes', { count: corrente.tratti })}
                  </span>
                )}

                {!feedback && (
                  <div className={styles.selfAssess}>
                    <p className={styles.selfAssessHint}>{t('quiz.kanjiPlay.selfAssessHint')}</p>
                    <div className={styles.selfAssessButtons}>
                      <Button variant="secondary" onClick={() => registra(false)}>
                        {t('quiz.kanjiPlay.didNotKnow')}
                      </Button>
                      <Button onClick={() => registra(true)}>
                        {t('quiz.kanjiPlay.knew')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Feedback comune (tutte le tipologie) */}
        {feedback && (
          <div
            className={[
              styles.feedback,
              feedback.corretto ? styles.feedbackOk : styles.feedbackWrong,
            ].join(' ')}
            role="status"
          >
            {feedback.corretto ? t('quiz.play.correct') : t('quiz.kanjiPlay.wrong')}
          </div>
        )}
      </Card>
    </div>
  );
};

export default KanjiQuizPlay;
