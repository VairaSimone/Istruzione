import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import ErrorState from '../../../components/shared/ErrorState';
import PronunciationButton from '../../../components/ui/PronunciationButton';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useStrokeOrder } from '../../../hooks/useStrokeOrder';
import { useRegistraScrittura } from '../../../hooks/useQuizMutations';
import { ALFABETI_QUIZ } from '../../../constants/quizDomain';
import { mostraBadgeSbloccati } from '../badgeToasts';
import StrokeOrderViewer from './StrokeOrderViewer';
import WritingCanvas from './WritingCanvas';
import styles from './WritingPracticePanel.module.css';

/**
 * WritingPracticePanel — modalità "Pratica di scrittura" del Quiz Kana.
 *
 * Riunisce le tre nuove modalità di studio per ogni carattere:
 *   1. Ordine dei tratti animato      → <StrokeOrderViewer/>
 *   2. Pronuncia (Text-to-Speech)     → <PronunciationButton/>
 *   3. Scrittura su schermo + verifica → <WritingCanvas/> (uno per componente)
 *
 * I dati dei tratti arrivano dal backend (GET /quiz/stroke/:alfabeto) e sono
 * messi in cache a lungo. Il carattere si seleziona da una griglia o con i
 * tasti precedente/successivo.
 *
 * @param {() => void} onBack  ritorno alla home del Quiz
 */
const WritingPracticePanel = ({ onBack }) => {
  const { t } = useTranslation();

  const [alfabeto, setAlfabeto] = useState('hiragana');
  const [indice, setIndice] = useState(0);

  const { data, isLoading, isError, error, refetch } = useStrokeOrder(alfabeto);

  const registraScritturaMutation = useRegistraScrittura();

  const caratteri = useMemo(() => data?.caratteri || [], [data]);
  const corrente = caratteri[indice] || null;

  // Cambiando alfabeto si riparte dal primo carattere.
  useEffect(() => {
    setIndice(0);
  }, [alfabeto]);

  /**
   * Completamento di un componente sul canvas: registra i tratti validati
   * (POST /quiz/scrittura) e notifica XP guadagnati ed eventuali badge.
   * Il tetto di tratti (1..50) è garantito a monte: un componente kana ne ha
   * sempre molti meno. Gli errori sono mostrati come toast non bloccante: la
   * pratica resta comunque utilizzabile anche offline o se la chiamata fallisce.
   */
  const handleScritturaCompletata = (nTratti, nErroriTratti = 0) => {
    if (!Number.isInteger(nTratti) || nTratti < 1) return;

    // Una voce per ogni tratto sbagliato del componente, attribuita al kana
    // corrente: alimenta la sezione "caratteri problematici" (errori_tratti).
    // Cap a 50 per coerenza col tetto del validator backend.
    const erroriDaSegnalare = Math.max(0, Math.min(Number(nErroriTratti) || 0, 50));
    const caratteriErrati =
      erroriDaSegnalare > 0 && corrente
        ? Array.from({ length: erroriDaSegnalare }, () => ({
            kana: corrente.kana,
            tipo: alfabeto,
          }))
        : undefined;

    registraScritturaMutation.mutate(
      { trattiValidati: nTratti, caratteriErrati },
      {
        onSuccess: (risposta) => {
          const risultato = risposta?.data?.risultato;
          const xp = risultato?.xpGuadagnati ?? 0;
          if (xp > 0) {
            toast.success(t('quiz.writing.xpEarned', { xp }), { icon: '🖌️' });
          }
          if (risultato?.salitoDiLivello) {
            toast.success(
              t('quiz.results.levelUp', {
                from: risultato.livelloPrima,
                to: risultato.livelloDopo,
              }),
              { icon: '⭐' }
            );
          }
          mostraBadgeSbloccati(t, risultato?.nuoviBadge);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(t, err));
        },
      }
    );
  };

  const vaiA = (i) => {
    if (caratteri.length === 0) return;
    const n = ((i % caratteri.length) + caratteri.length) % caratteri.length;
    setIndice(n);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          {t('quiz.practice.back')}
        </Button>

        <div className={styles.segmented} role="tablist" aria-label={t('quiz.setup.alphabetLegend')}>
          {ALFABETI_QUIZ.map((alf) => (
            <button
              key={alf}
              type="button"
              role="tab"
              aria-selected={alfabeto === alf}
              className={[styles.segment, alfabeto === alf ? styles.segmentActive : ''].join(' ')}
              onClick={() => setAlfabeto(alf)}
            >
              {t(`quiz.alphabets.${alf}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className={styles.center}>
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      )}

      {isError && (
        <ErrorState message={getApiErrorMessage(t, error)} onRetry={refetch} />
      )}

      {data && corrente && (
        <>
          <Card className={styles.studio}>
            {/* Intestazione carattere: glifo, romaji, pronuncia */}
            <div className={styles.intestazione}>
              <div className={styles.glifoBlocco}>
                <span className={styles.glifo}>{corrente.kana}</span>
                <span className={styles.romaji}>{corrente.romaji}</span>
              </div>
              <PronunciationButton testo={corrente.kana} size="lg" />
            </div>

            {/* 1. Ordine dei tratti animato */}
            <section className={styles.sezione} aria-label={t('quiz.strokeOrder.title')}>
              <h3 className={styles.sezioneTitolo}>{t('quiz.strokeOrder.title')}</h3>
              <StrokeOrderViewer
                key={`${alfabeto}-${corrente.kana}`}
                componenti={corrente.componenti}
                viewBox={data.viewBox}
              />
            </section>

            {/* 3. Scrittura su schermo (un canvas per componente) */}
            <section className={styles.sezione} aria-label={t('quiz.writing.title')}>
              <h3 className={styles.sezioneTitolo}>{t('quiz.writing.title')}</h3>
              <p className={styles.suggerimento}>{t('quiz.writing.hint')}</p>
              <div className={styles.canvasGriglia}>
                {corrente.componenti.map((comp, i) => (
                  <WritingCanvas
                    key={`${alfabeto}-${corrente.kana}-${i}`}
                    componente={comp}
                    viewBox={data.viewBox}
                    onCompletato={handleScritturaCompletata}
                  />
                ))}
              </div>
            </section>

            {/* Navigazione precedente/successivo */}
            <div className={styles.navigazione}>
              <Button variant="secondary" onClick={() => vaiA(indice - 1)}>
                {t('quiz.practice.prev')}
              </Button>
              <span className={styles.contatore}>
                {t('quiz.practice.counter', { current: indice + 1, total: caratteri.length })}
              </span>
              <Button variant="secondary" onClick={() => vaiA(indice + 1)}>
                {t('quiz.practice.next')}
              </Button>
            </div>
          </Card>

          {/* Selettore a griglia di tutti i caratteri */}
          <Card className={styles.grigliaCard}>
            <h3 className={styles.sezioneTitolo}>{t('quiz.practice.pickerTitle')}</h3>
            <div className={styles.griglia}>
              {caratteri.map((c, i) => (
                <button
                  key={c.kana}
                  type="button"
                  className={[styles.cellaKana, i === indice ? styles.cellaKanaAttiva : ''].join(' ')}
                  aria-pressed={i === indice}
                  onClick={() => setIndice(i)}
                  title={c.romaji}
                >
                  {c.kana}
                </button>
              ))}
            </div>
          </Card>

          {/* Attribuzione obbligatoria (share-alike) dei dati dei tratti. */}
          {data.licenza && (
            <p className={styles.attribuzione}>
              {t('quiz.strokeOrder.attribution', {
                source: data.licenza.fonte,
                license: data.licenza.licenza,
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default WritingPracticePanel;
