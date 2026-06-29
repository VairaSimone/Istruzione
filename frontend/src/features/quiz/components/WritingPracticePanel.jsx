import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import ErrorState from '../../../components/shared/ErrorState';
import PronunciationButton from '../../../components/ui/PronunciationButton';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useStrokeOrder } from '../../../hooks/useStrokeOrder';
import { ALFABETI_QUIZ } from '../../../constants/quizDomain';
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

  const caratteri = useMemo(() => data?.caratteri || [], [data]);
  const corrente = caratteri[indice] || null;

  // Cambiando alfabeto si riparte dal primo carattere.
  useEffect(() => {
    setIndice(0);
  }, [alfabeto]);

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
