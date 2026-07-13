import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import { TIMER_SECONDI, COMBO_SOGLIA } from '../../../constants/quizDomain';
import styles from './BancaQuizPlay.module.css';

/**
 * Schermata di gioco del motore BANCA (banche dati di piattaforma: web, verbi
 * inglesi, chimica, geografia, simboli, cinese…). Gemella di `KanjiQuizPlay`
 * nella modalità *recognition*: si mostra un PROMPT (il carattere/termine) e si
 * sceglie la risposta corretta tra quattro opzioni (`indiceCorretto`).
 *
 * La correttezza è calcolata qui (indice scelto vs `indiceCorretto`) e
 * accumulata come `{ voceId, corretto }[]`, la forma attesa dal backend per
 * `dominio='banca'`. XP/SRS/streak/record li calcola il server.
 *
 * I testi localizzati (istruzione della modalità, etichette, spiegazione)
 * arrivano dal backend come oggetti `{ it, en }`: si risolvono con la lingua
 * dell'interfaccia. Il contenuto delle voci (prompt e opzioni) è invece un dato
 * fattuale (codici, simboli, pinyin…) e non è localizzato.
 *
 * @param {{
 *   dominio:'banca', bancaCodice:string, materia:string,
 *   modalita:string, istruzione:{it:string,en:string}, totale:number,
 *   voci:Array<{voceId:string, prompt:string, etichettaPrompt?:object,
 *               etichettaRisposta?:object, opzioni:string[],
 *               indiceCorretto:number, spiegazione?:object}>
 * }} sessione
 * @param {boolean} timerMode
 * @param {(risposte:Array, datiBonus:{maxCombo:number, timerMode:boolean}) => void} onComplete
 */
const BancaQuizPlay = ({ sessione, timerMode = false, onComplete }) => {
  const { t, i18n } = useTranslation();

  // Risolutore di campo localizzato { it, en } → stringa nella lingua attiva.
  const loc = (valore) => {
    if (!valore) return '';
    if (typeof valore === 'string') return valore;
    const lingua = i18n.language?.startsWith('en') ? 'en' : 'it';
    return valore[lingua] ?? valore.it ?? valore.en ?? '';
  };

  const domande = sessione.voci;
  const totale = domande.length;

  const [indice, setIndice] = useState(0);
  const [combo, setCombo] = useState(0);
  const [scelta, setScelta] = useState(null);
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
      { voceId: corrente.voceId, corretto },
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
        setFeedback(null);
        setValutando(false);
        setSecondiRimasti(TIMER_SECONDI);
      }
    }, 1200);
  };

  // Riferimento stabile all'ultima `registra` per il timer.
  const registraRef = useRef(registra);
  useEffect(() => {
    registraRef.current = registra;
  });

  // Countdown della modalità a tempo.
  useEffect(() => {
    if (!timerMode || valutando || feedback || secondiRimasti <= 0) return undefined;
    const id = setTimeout(() => setSecondiRimasti((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerMode, valutando, feedback, secondiRimasti]);

  // Allo scadere del tempo, marca la domanda come errata (una sola volta).
  useEffect(() => {
    if (timerMode && !valutando && !feedback && secondiRimasti === 0) {
      registraRef.current(false);
    }
  }, [timerMode, valutando, feedback, secondiRimasti]);

  // Pulizia del timer di avanzamento allo smontaggio.
  useEffect(() => () => clearTimeout(avanzamentoRef.current), []);

  const percentualeAvanzamento = Math.round((indice / totale) * 100);
  const comboAttiva = combo >= COMBO_SOGLIA;

  // Prompt lungo (es. verbi, significati) ⇒ carattere più contenuto.
  const promptLungo = (corrente.prompt || '').length > 6;

  // Classe dell'opzione dopo la risposta.
  const classeOpzione = (i) => {
    if (!feedback) return styles.option;
    if (i === corrente.indiceCorretto) return [styles.option, styles.optionCorrect].join(' ');
    if (i === scelta) return [styles.option, styles.optionWrong].join(' ');
    return [styles.option, styles.optionDim].join(' ');
  };

  const etichettaPrompt = loc(corrente.etichettaPrompt);
  const etichettaRisposta = loc(corrente.etichettaRisposta);
  const spiegazione = loc(corrente.spiegazione);

  return (
    <div className={styles.wrapper}>
      {/* Barra di avanzamento del round */}
      <div className={styles.topBar}>
        <span className={styles.counter}>
          {t('quiz.play.progress', { current: indice + 1, total: totale })}
        </span>
        <span className={styles.subjectTag}>{sessione.materia}</span>
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
        {/* Countdown modalità a tempo */}
        {timerMode && (
          <div className={styles.timer} aria-hidden="true">
            <div
              className={[styles.timerFill, secondiRimasti <= 3 ? styles.timerLow : ''].join(' ')}
              style={{ width: `${(secondiRimasti / TIMER_SECONDI) * 100}%` }}
            />
          </div>
        )}

        {/* Istruzione della modalità (es. "Scegli il significato corretto.") */}
        <span className={styles.prompt}>{loc(sessione.istruzione)}</span>

        {/* Prompt: carattere/termine da riconoscere */}
        {etichettaPrompt && <span className={styles.promptLabel}>{etichettaPrompt}</span>}
        <div
          className={[
            styles.term,
            promptLungo ? styles.termLong : '',
            feedback ? (feedback.corretto ? styles.termOk : styles.termWrong) : '',
          ].join(' ')}
        >
          {corrente.prompt}
        </div>

        {/* Opzioni a scelta multipla */}
        {etichettaRisposta && <span className={styles.answerLabel}>{etichettaRisposta}</span>}
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

        {/* Feedback + eventuale spiegazione (a partita della domanda conclusa) */}
        {feedback && (
          <div
            className={[
              styles.feedback,
              feedback.corretto ? styles.feedbackOk : styles.feedbackWrong,
            ].join(' ')}
            role="status"
          >
            <span className={styles.feedbackText}>
              {feedback.corretto
                ? t('quiz.play.correct')
                : t('quiz.play.wrong', {
                    answer: corrente.opzioni[corrente.indiceCorretto],
                  })}
            </span>
            {spiegazione && (
              <span className={styles.feedbackNote}>
                <span className={styles.feedbackNoteLabel}>{t('quiz.bancaPlay.note')}</span>
                {spiegazione}
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BancaQuizPlay;
