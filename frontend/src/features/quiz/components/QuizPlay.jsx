import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import PronunciationButton from '../../../components/ui/PronunciationButton';
import {
  ROMAJI_ALTERNATIVI,
  TIMER_SECONDI,
  COMBO_SOGLIA,
} from '../../../constants/quizDomain';
import styles from './QuizPlay.module.css';

/**
 * Schermata di gioco del Quiz Kana (modalità "kana → romaji").
 * Mostra un carattere alla volta; lo studente digita la romanizzazione. La
 * correttezza è calcolata qui (confronto con la romaji canonica del backend,
 * con tolleranza per le varianti comuni) e accumulata in `risposte`, inviate
 * a `onComplete` al termine.
 *
 * @param {{alfabeto:string, totale:number, kana:Array}} sessione
 * @param {boolean} timerMode
 * @param {(risposte:Array, datiBonus:{maxCombo:number, timerMode:boolean}) => void} onComplete
 */
const QuizPlay = ({ sessione, timerMode = false, onComplete }) => {
  const { t } = useTranslation();

  const kanaList = sessione.kana;
  const totale = kanaList.length;

  const [indice, setIndice] = useState(0);
  const [input, setInput] = useState('');
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null); // { corretto, atteso }
  const [valutando, setValutando] = useState(false);
  const [secondiRimasti, setSecondiRimasti] = useState(TIMER_SECONDI);

  const risposteRef = useRef([]);
  const maxComboRef = useRef(0);
  const inputRef = useRef(null);
  const avanzamentoRef = useRef(null);

  const corrente = kanaList[indice];

  // Verifica la risposta contro la romaji canonica e le varianti accettate.
  const verificaRisposta = (testo, romaji) => {
    const normalizzato = testo.trim().toLowerCase();
    if (!normalizzato) return false;
    if (normalizzato === romaji) return true;
    const alternative = ROMAJI_ALTERNATIVI[romaji];
    return Array.isArray(alternative) && alternative.includes(normalizzato);
  };

  // Registra l'esito della domanda corrente e programma l'avanzamento.
  const registra = (corretto) => {
    if (valutando) return;
    setValutando(true);

    const nuovaCombo = corretto ? combo + 1 : 0;
    if (nuovaCombo > maxComboRef.current) maxComboRef.current = nuovaCombo;
    setCombo(nuovaCombo);

    risposteRef.current = [
      ...risposteRef.current,
      { kana: corrente.kana, tipo: corrente.tipo, corretto },
    ];
    setFeedback({ corretto, atteso: corrente.romaji });

    avanzamentoRef.current = setTimeout(() => {
      if (indice + 1 >= totale) {
        onComplete(risposteRef.current, {
          maxCombo: maxComboRef.current,
          timerMode,
        });
      } else {
        setIndice((i) => i + 1);
        setInput('');
        setFeedback(null);
        setValutando(false);
        setSecondiRimasti(TIMER_SECONDI);
      }
    }, 900);
  };

  // Mantiene un riferimento stabile all'ultima `registra` per il timer.
  const registraRef = useRef(registra);
  useEffect(() => {
    registraRef.current = registra;
  });

  // Countdown della modalità a tempo: decrementa di un secondo finché resta
  // tempo. Inattivo durante il feedback o la valutazione.
  useEffect(() => {
    if (!timerMode || valutando || feedback || secondiRimasti <= 0) return undefined;
    const id = setTimeout(() => setSecondiRimasti((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerMode, valutando, feedback, secondiRimasti]);

  // Allo scadere del tempo, marca la domanda corrente come errata (una volta
  // sola: `registra` imposta `valutando`, disinnescando la condizione).
  useEffect(() => {
    if (timerMode && !valutando && !feedback && secondiRimasti === 0) {
      registraRef.current(false);
    }
  }, [timerMode, valutando, feedback, secondiRimasti]);

  // Focus automatico sul campo a ogni nuova domanda.
  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
  }, [indice, feedback]);

  // Pulizia del timer di avanzamento allo smontaggio.
  useEffect(() => () => clearTimeout(avanzamentoRef.current), []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!valutando) registra(verificaRisposta(input, corrente.romaji));
    }
  };

  const percentualeAvanzamento = Math.round((indice / totale) * 100);
  const comboAttiva = combo >= COMBO_SOGLIA;

  return (
    <div className={styles.wrapper}>
      {/* Barra di avanzamento del round */}
      <div className={styles.topBar}>
        <span className={styles.counter}>
          {t('quiz.play.progress', { current: indice + 1, total: totale })}
        </span>
        {combo > 0 && (
          <span className={[styles.combo, comboAttiva ? styles.comboHot : ''].join(' ')}>
            {t('quiz.play.combo', { count: combo })}
            {comboAttiva && (
              <span className={styles.comboBoost}>{t('quiz.play.comboBoost')}</span>
            )}
          </span>
        )}
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${percentualeAvanzamento}%` }}
        />
      </div>

      <Card className={styles.stage}>
        {/* Countdown modalità a tempo */}
        {timerMode && (
          <div className={styles.timer} aria-hidden="true">
            <div
              className={[
                styles.timerFill,
                secondiRimasti <= 3 ? styles.timerLow : '',
              ].join(' ')}
              style={{ width: `${(secondiRimasti / TIMER_SECONDI) * 100}%` }}
            />
          </div>
        )}

        <span className={styles.prompt}>{t('quiz.play.prompt')}</span>
        <div
          key={indice}
          className={[
            styles.kana,
            feedback ? (feedback.corretto ? styles.kanaOk : styles.kanaWrong) : '',
          ].join(' ')}
        >
          {corrente.kana}
        </div>

        {/* Feedback dopo la risposta */}
        {feedback ? (
          <div
            className={[
              styles.feedback,
              feedback.corretto ? styles.feedbackOk : styles.feedbackWrong,
            ].join(' ')}
            role="status"
          >
            {feedback.corretto ? (
              <span>{t('quiz.play.correct')}</span>
            ) : (
              <span>{t('quiz.play.wrong', { answer: feedback.atteso })}</span>
            )}
            <PronunciationButton testo={corrente.kana} label={corrente.kana} size="sm" />
          </div>
        ) : (
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('quiz.play.inputPlaceholder')}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              aria-label={t('quiz.play.inputPlaceholder')}
              disabled={valutando}
            />
            <Button
              onClick={() =>
                !valutando && registra(verificaRisposta(input, corrente.romaji))
              }
              disabled={valutando}
            >
              {t('quiz.play.check')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default QuizPlay;
