import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './DomandeQuizPlay.module.css';

/**
 * Schermata di gioco dei QUIZ PERSONALIZZATI (motore `domande`).
 *
 * A differenza di kana e kanji, qui il client NON conosce la soluzione: il
 * backend non la invia mai. Non c'è quindi feedback immediato né combo (che si
 * calcola sulle risposte consecutive corrette): si risponde a tutte le domande,
 * si consegna, e la correzione arriva con l'esito del round.
 *
 * Per lo stesso motivo la modalità a tempo non è applicabile: `datiBonus` viene
 * inviato con `maxCombo: 0` e `timerMode: false`.
 *
 * Forma delle risposte attesa dal backend:
 *   scelta_multipla / vero_falso → { domandaId, opzioneId }
 *   risposta_breve               → { domandaId, testo }
 *
 * @param {{dominio:'domande', titolo:string, materia:string, totale:number,
 *          domande:Array<{id,tipo,testo,mediaUrl,punteggio,opzioni:Array}>}} sessione
 * @param {(risposte:Array, datiBonus:{maxCombo:number, timerMode:boolean}) => void} onComplete
 */
const DomandeQuizPlay = ({ sessione, onComplete }) => {
  const { t } = useTranslation();

  const domande = sessione.domande ?? [];
  const totale = domande.length;

  const [indice, setIndice] = useState(0);
  // Mappa domandaId → { opzioneId } | { testo }
  const [risposte, setRisposte] = useState({});

  const corrente = domande[indice];
  const rispostaCorrente = risposte[corrente?.id];

  const impostaRisposta = (valore) => {
    setRisposte((precedenti) => ({ ...precedenti, [corrente.id]: valore }));
  };

  const haRisposto =
    Boolean(rispostaCorrente?.opzioneId) ||
    Boolean(rispostaCorrente?.testo && rispostaCorrente.testo.trim());

  const consegna = () => {
    // Le domande senza risposta non vengono inviate: il backend le ignorerebbe
    // comunque, e conteggiarle come errate senza che lo studente lo sappia
    // sarebbe scorretto. Il round vale sulle domande effettivamente affrontate.
    const payload = Object.entries(risposte)
      .filter(([, valore]) => valore.opzioneId || valore.testo?.trim())
      .map(([domandaId, valore]) => ({ domandaId, ...valore }));

    onComplete(payload, { maxCombo: 0, timerMode: false });
  };

  if (!corrente) return null;

  const ultima = indice + 1 >= totale;
  const percentualeAvanzamento = Math.round((indice / totale) * 100);
  const risposteDate = Object.values(risposte).filter(
    (r) => r.opzioneId || r.testo?.trim()
  ).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <span className={styles.counter}>
          {t('quiz.play.progress', { current: indice + 1, total: totale })}
        </span>
        {sessione.titolo && <span className={styles.quizTitle}>{sessione.titolo}</span>}
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${percentualeAvanzamento}%` }} />
      </div>

      <Card className={styles.stage}>
        <span className={styles.prompt}>
          {t(`quizGestione.domanda.tipi.${corrente.tipo}`)}
        </span>

        <h2 className={styles.testo}>{corrente.testo}</h2>

        {corrente.mediaUrl && (
          <img className={styles.media} src={corrente.mediaUrl} alt="" loading="lazy" />
        )}

        {/* ── Domande a scelta ── */}
        {corrente.tipo !== 'risposta_breve' && (
          <div className={styles.options} role="radiogroup" aria-label={corrente.testo}>
            {(corrente.opzioni ?? []).map((opzione) => {
              const scelta = rispostaCorrente?.opzioneId === opzione.id;
              return (
                <button
                  key={opzione.id}
                  type="button"
                  role="radio"
                  aria-checked={scelta}
                  className={[styles.option, scelta ? styles.optionSelected : ''].join(' ')}
                  onClick={() => impostaRisposta({ opzioneId: opzione.id })}
                >
                  {opzione.testo}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Risposta breve ── */}
        {corrente.tipo === 'risposta_breve' && (
          <input
            type="text"
            className={styles.input}
            value={rispostaCorrente?.testo ?? ''}
            onChange={(e) => impostaRisposta({ testo: e.target.value })}
            placeholder={t('quiz.domande.answerPlaceholder')}
            aria-label={t('quiz.domande.answerPlaceholder')}
            autoComplete="off"
          />
        )}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
          >
            {t('common.previous')}
          </Button>

          {ultima ? (
            <Button onClick={consegna} disabled={risposteDate === 0}>
              {t('quiz.domande.submit')}
            </Button>
          ) : (
            <Button onClick={() => setIndice((i) => i + 1)} disabled={!haRisposto}>
              {t('common.next')}
            </Button>
          )}
        </div>

        <p className={styles.hint}>
          {t('quiz.domande.answered', { answered: risposteDate, total: totale })}
        </p>
      </Card>
    </div>
  );
};

export default DomandeQuizPlay;
