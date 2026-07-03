import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/shared/EmptyState';
import ErrorState from '../../../components/shared/ErrorState';
import PronunciationButton from '../../../components/ui/PronunciationButton';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useStrokeOrder, useStrokeOrderKanji } from '../../../hooks/useStrokeOrder';
import { useRegistraScrittura } from '../../../hooks/useQuizMutations';
import { ALFABETI_QUIZ, DOMINI_QUIZ, LIVELLI_JLPT } from '../../../constants/quizDomain';
import { mostraBadgeSbloccati } from '../badgeToasts';
import StrokeOrderViewer from './StrokeOrderViewer';
import WritingCanvas from './WritingCanvas';
import styles from './WritingPracticePanel.module.css';

/**
 * WritingPracticePanel — modalità "Pratica di scrittura" del Quiz (Kana e Kanji).
 *
 * Riunisce le modalità di studio per ogni carattere:
 *   1. Ordine dei tratti animato      → <StrokeOrderViewer/>
 *   2. Pronuncia (Text-to-Speech)     → <PronunciationButton/>
 *   3. Scrittura su schermo + verifica → <WritingCanvas/> (uno per componente)
 *
 * Un selettore di dominio commuta tra kana (per alfabeto) e kanji (per livello
 * JLPT). I dati dei tratti arrivano dal backend tramite l'interfaccia unica
 * (GET /quiz/stroke/:alfabeto e /quiz/stroke/kanji/:livello) e sono messi in
 * cache a lungo. Per i livelli kanji ancora privi di dati grafici il pannello
 * mostra uno stato "non ancora disponibile" (il backend li omette con eleganza).
 *
 * @param {() => void} onBack  ritorno alla home del Quiz
 */
const WritingPracticePanel = ({ onBack }) => {
  const { t, i18n } = useTranslation();

  const [dominio, setDominio] = useState('kana');
  const [alfabeto, setAlfabeto] = useState('hiragana');
  const [livello, setLivello] = useState('N5');
  const [indice, setIndice] = useState(0);

  const lingua = i18n.language?.startsWith('en') ? 'en' : 'it';

  // Una sola query è attiva per volta (l'altra è disabilitata).
  const kanaQuery = useStrokeOrder(alfabeto, { enabled: dominio === 'kana' });
  const kanjiQuery = useStrokeOrderKanji(livello, lingua, { enabled: dominio === 'kanji' });
  const { data, isLoading, isError, error, refetch } =
    dominio === 'kanji' ? kanjiQuery : kanaQuery;

  const registraScritturaMutation = useRegistraScrittura();

  const caratteri = useMemo(() => data?.caratteri || [], [data]);
  const corrente = caratteri[indice] || null;

  // Glifo del carattere corrente (campo diverso per dominio).
  const glifoDi = (c) => (c ? c.kana ?? c.kanji : null);
  const glifo = glifoDi(corrente);

  // Cambiando dominio/alfabeto/livello si riparte dal primo carattere. Si usa
  // il pattern "aggiusta lo stato durante il render" (traccia della chiave del
  // dataset) invece di un effetto: reset sincrono, senza render a cascata.
  const chiaveDataset = `${dominio}:${alfabeto}:${livello}`;
  const [chiavePrec, setChiavePrec] = useState(chiaveDataset);
  if (chiaveDataset !== chiavePrec) {
    setChiavePrec(chiaveDataset);
    setIndice(0);
  }

  /**
   * Completamento di un componente sul canvas: registra i tratti validati
   * (POST /quiz/scrittura) e notifica XP guadagnati ed eventuali badge.
   *
   * Gli XP di scrittura (per tratto) sono comuni ai due domini. L'attribuzione
   * degli errori di tratto ai "caratteri problematici" è invece kana-specifica
   * lato backend: per i kanji si registrano quindi solo i tratti validati (XP),
   * senza `caratteriErrati`. Gli errori sono toast non bloccanti: la pratica
   * resta utilizzabile anche se la chiamata fallisce.
   */
  const handleScritturaCompletata = (nTratti, nErroriTratti = 0) => {
    if (!Number.isInteger(nTratti) || nTratti < 1) return;

    const erroriDaSegnalare = Math.max(0, Math.min(Number(nErroriTratti) || 0, 50));
    const caratteriErrati =
      dominio === 'kana' && erroriDaSegnalare > 0 && corrente
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

        {/* Selettore di dominio */}
        <div className={styles.segmented} role="tablist" aria-label={t('quiz.setup.domainLegend')}>
          {DOMINI_QUIZ.map((dom) => (
            <button
              key={dom}
              type="button"
              role="tab"
              aria-selected={dominio === dom}
              className={[styles.segment, dominio === dom ? styles.segmentActive : ''].join(' ')}
              onClick={() => setDominio(dom)}
            >
              {t(`quiz.domains.${dom}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Sotto-selettore: alfabeto (kana) o livello (kanji) */}
      <div className={styles.subSelectorRow}>
        {dominio === 'kana' ? (
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
        ) : (
          <div className={styles.segmented} role="tablist" aria-label={t('quiz.setup.levelLegend')}>
            {LIVELLI_JLPT.map((liv) => (
              <button
                key={liv}
                type="button"
                role="tab"
                aria-selected={livello === liv}
                className={[styles.segment, livello === liv ? styles.segmentActive : ''].join(' ')}
                onClick={() => setLivello(liv)}
              >
                {liv}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className={styles.center}>
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      )}

      {isError && <ErrorState message={getApiErrorMessage(t, error)} onRetry={refetch} />}

      {/* Livello kanji senza dati dei tratti: stato dedicato. */}
      {data && caratteri.length === 0 && (
        <EmptyState
          title={t('quiz.practice.kanjiEmptyTitle')}
          description={t('quiz.practice.kanjiEmptyDescription', { level: livello })}
        />
      )}

      {data && corrente && (
        <>
          <Card className={styles.studio}>
            {/* Intestazione carattere: glifo, letture/romaji, pronuncia */}
            <div className={styles.intestazione}>
              <div className={styles.glifoBlocco}>
                <span className={styles.glifo}>{glifo}</span>
                {dominio === 'kana' ? (
                  <span className={styles.romaji}>{corrente.romaji}</span>
                ) : (
                  <span className={styles.kanjiMeta}>
                    {(corrente.significati || []).slice(0, 3).join(', ')}
                  </span>
                )}
              </div>
              <PronunciationButton testo={glifo} size="lg" />
            </div>

            {/* Letture kanji (on/kun) sotto l'intestazione */}
            {dominio === 'kanji' && (
              <div className={styles.letture}>
                {corrente.onYomi?.length > 0 && (
                  <span className={styles.letturaGruppo}>
                    <span className={styles.letturaEtichetta}>{t('quiz.kanjiPlay.onYomi')}</span>
                    {corrente.onYomi.join('・')}
                  </span>
                )}
                {corrente.kunYomi?.length > 0 && (
                  <span className={styles.letturaGruppo}>
                    <span className={styles.letturaEtichetta}>{t('quiz.kanjiPlay.kunYomi')}</span>
                    {corrente.kunYomi.join('・')}
                  </span>
                )}
              </div>
            )}

            {/* 1. Ordine dei tratti animato */}
            <section className={styles.sezione} aria-label={t('quiz.strokeOrder.title')}>
              <h3 className={styles.sezioneTitolo}>{t('quiz.strokeOrder.title')}</h3>
              <StrokeOrderViewer
                key={`${dominio}-${glifo}`}
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
                    key={`${dominio}-${glifo}-${i}`}
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
              {caratteri.map((c, i) => {
                const g = glifoDi(c);
                return (
                  <button
                    key={g}
                    type="button"
                    className={[styles.cellaKana, i === indice ? styles.cellaKanaAttiva : ''].join(' ')}
                    aria-pressed={i === indice}
                    onClick={() => setIndice(i)}
                    title={dominio === 'kana' ? c.romaji : (c.significati || [])[0]}
                  >
                    {g}
                  </button>
                );
              })}
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
