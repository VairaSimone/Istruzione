import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuizDashboard } from '../hooks/useQuizDashboard';
import { useGenerateQuiz, useSubmitQuizResults } from '../hooks/useQuizMutations';
import { useAllenamentoIntensivo } from '../hooks/useAllenamentoIntensivo';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import ErrorState from '../components/shared/ErrorState';
import QuizStatsPanel from '../features/quiz/components/QuizStatsPanel';
import QuizSetup from '../features/quiz/components/QuizSetup';
import QuizPlay from '../features/quiz/components/QuizPlay';
import KanjiQuizPlay from '../features/quiz/components/KanjiQuizPlay';
import DomandeQuizPlay from '../features/quiz/components/DomandeQuizPlay';
import QuizDisponibiliPanel from '../features/quiz/components/QuizDisponibiliPanel';
import QuizResults from '../features/quiz/components/QuizResults';
import WritingPracticePanel from '../features/quiz/components/WritingPracticePanel';
import StreakCard from '../features/quiz/components/StreakCard';
import ActivityHeatmap from '../features/quiz/components/ActivityHeatmap';
import ProblematicCharsPanel from '../features/quiz/components/ProblematicCharsPanel';
import { mostraBadgeSbloccati } from '../features/quiz/badgeToasts';
import styles from './QuizPage.module.css';

/**
 * Pagina del Quiz. Orchestratore a fasi:
 *
 *   home → setup → playing → (submitting) → results
 *
 * Tre modi di iniziare una partita:
 *   1. allenamento libero kana/kanji (se la scuola non lo ha disabilitato);
 *   2. quiz della scuola creato da un TEMPLATE  → passa dal setup, dove restano
 *      configurabili solo i campi che la scuola non ha fissato;
 *   3. quiz della scuola PERSONALIZZATO         → parte subito, nessun setup.
 *
 * La logica di dominio vive nel backend (SRS, XP, streak, record, correzione):
 * qui si coordinano solo le chiamate e le transizioni di vista.
 */
const FASI = {
  HOME: 'home',
  SETUP: 'setup',
  PLAYING: 'playing',
  SUBMITTING: 'submitting',
  RESULTS: 'results',
  PRACTICE: 'practice',
};

const QuizPage = () => {
  const { t } = useTranslation();

  const [fase, setFase] = useState(FASI.HOME);
  const [sessione, setSessione] = useState(null);
  // Quiz della scuola scelto dall'elenco (null ⇒ allenamento libero).
  const [quizSelezionato, setQuizSelezionato] = useState(null);
  const [timerMode, setTimerMode] = useState(false);
  const [esito, setEsito] = useState(null);

  const dashboard = useQuizDashboard();
  const generateMutation = useGenerateQuiz();
  const submitMutation = useSubmitQuizResults();
  const intensivoMutation = useAllenamentoIntensivo();

  // ── Avvio partita: genera la sessione, poi passa al gioco ──────────
  const handleStart = (filtri, modalitaTempo) => {
    setTimerMode(modalitaTempo);
    generateMutation.mutate(filtri, {
      onSuccess: (data) => {
        setSessione(data.data.sessione);
        setFase(FASI.PLAYING);
      },
      // L'errore è mostrato in linea dentro QuizSetup (vedi sotto).
    });
  };

  // ── Avvio di un quiz della scuola ─────────────────────────────────
  // Un quiz da template ha ancora dei filtri da scegliere: si passa dal setup.
  // Un quiz personalizzato è già completo: si genera e si gioca subito.
  const handleStartQuizScuola = (quiz) => {
    setQuizSelezionato(quiz);

    if (quiz.templateCodice) {
      generateMutation.reset();
      setFase(FASI.SETUP);
      return;
    }

    setTimerMode(false);
    generateMutation.mutate(
      { quizId: quiz.id },
      {
        onSuccess: (data) => {
          setSessione(data.data.sessione);
          setFase(FASI.PLAYING);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(t, err));
          setQuizSelezionato(null);
        },
      }
    );
  };

  // ── Avvio Allenamento Intensivo: pool mirato sui caratteri deboli ──
  const handleStartIntensivo = (alfabeto) => {
    intensivoMutation.mutate(
      { alfabeto },
      {
        onSuccess: (data) => {
          setTimerMode(false);
          setSessione(data.data.sessione);
          setFase(FASI.PLAYING);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(t, err));
        },
      }
    );
  };

  // ── Fine partita: invia i risultati, poi mostra l'esito ────────────
  const handleComplete = (risposte, datiBonus) => {
    setFase(FASI.SUBMITTING);
    submitMutation.mutate(
      {
        ...(sessione?.quizId ? { quizId: sessione.quizId } : {}),
        dominio: sessione?.dominio || 'kana',
        risposte,
        datiBonus,
      },
      {
        onSuccess: (data) => {
          setEsito(data.data); // { risultatoRound, statistiche }
          setFase(FASI.RESULTS);
          // Toast per i badge eventualmente sbloccati nel round.
          mostraBadgeSbloccati(t, data.data?.risultatoRound?.nuoviBadge);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(t, err));
          // I quiz personalizzati non hanno una schermata di configurazione:
          // si torna alla home, da cui si può rilanciare la partita.
          setFase(sessione?.dominio === 'domande' ? FASI.HOME : FASI.SETUP);
        },
      }
    );
  };

  const vaiAllaConfigurazione = () => {
    generateMutation.reset();
    // "Gioca ancora" dopo un quiz personalizzato non ha filtri da mostrare.
    if (quizSelezionato && !quizSelezionato.templateCodice) {
      handleStartQuizScuola(quizSelezionato);
      return;
    }
    setFase(FASI.SETUP);
  };

  const tornaAllaHome = () => {
    setSessione(null);
    setEsito(null);
    setQuizSelezionato(null);
    setFase(FASI.HOME);
  };

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('quiz.pageTitle')}</h1>
        <p className={styles.subtitle}>{t('quiz.pageSubtitle')}</p>
      </header>

      {/* ── HOME: statistiche + avvio ─────────────────────────── */}
      {fase === FASI.HOME && (
        <>
          {dashboard.isLoading && <Spinner size="lg" label={t('common.loading')} />}

          {dashboard.isError && (
            <ErrorState
              message={getApiErrorMessage(t, dashboard.error)}
              onRetry={dashboard.refetch}
            />
          )}

          {dashboard.isSuccess && (
            <div className={styles.homeLayout}>
              <QuizStatsPanel
                statistiche={dashboard.data.statistiche}
                mastered={dashboard.data.mastered}
                peggioriKana={dashboard.data.peggioriKana}
              />
              <div className={styles.startBar}>
                <Button
                  size="lg"
                  onClick={() => {
                    setQuizSelezionato(null);
                    vaiAllaConfigurazione();
                  }}
                >
                  {t('quiz.startSession')}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => setFase(FASI.PRACTICE)}
                >
                  {t('quiz.practiceWriting')}
                </Button>
              </div>

              {/* Quiz assegnati dalla scuola (template installati o personalizzati) */}
              <QuizDisponibiliPanel
                onStartQuiz={handleStartQuizScuola}
                isStarting={generateMutation.isPending}
              />

              {/* Progressi: streak, heatmap attività, caratteri problematici */}
              <section className={styles.progressi} aria-label={t('quiz.progress.title')}>
                <StreakCard />
                <ActivityHeatmap />
                <ProblematicCharsPanel
                  onStartIntensivo={handleStartIntensivo}
                  isStarting={intensivoMutation.isPending}
                />
              </section>
            </div>
          )}
        </>
      )}

      {/* ── PRACTICE: ordine tratti, scrittura su schermo, audio ─ */}
      {fase === FASI.PRACTICE && <WritingPracticePanel onBack={tornaAllaHome} />}

      {/* ── SETUP: filtri di gioco ────────────────────────────── */}
      {fase === FASI.SETUP && (
        <QuizSetup
          quiz={quizSelezionato}
          onStart={handleStart}
          onBack={tornaAllaHome}
          isLoading={generateMutation.isPending}
          errorMessage={
            generateMutation.isError ? getApiErrorMessage(t, generateMutation.error) : null
          }
        />
      )}

      {/* ── PLAYING: partita in corso (kana o kanji) ──────────── */}
      {fase === FASI.PLAYING && sessione && (
        sessione.dominio === 'domande' ? (
          <DomandeQuizPlay sessione={sessione} onComplete={handleComplete} />
        ) : sessione.dominio === 'kanji' ? (
          <KanjiQuizPlay sessione={sessione} timerMode={timerMode} onComplete={handleComplete} />
        ) : (
          <QuizPlay sessione={sessione} timerMode={timerMode} onComplete={handleComplete} />
        )
      )}

      {/* ── SUBMITTING: salvataggio risultati ─────────────────── */}
      {fase === FASI.SUBMITTING && (
        <div className={styles.submitting}>
          <Spinner size="lg" label={t('quiz.saving')} />
          <p className={styles.submittingText}>{t('quiz.saving')}</p>
        </div>
      )}

      {/* ── RESULTS: esito del round ──────────────────────────── */}
      {fase === FASI.RESULTS && esito && (
        <QuizResults
          risultatoRound={esito.risultatoRound}
          statistiche={esito.statistiche}
          domande={sessione?.domande ?? []}
          onPlayAgain={vaiAllaConfigurazione}
          onBackToDashboard={tornaAllaHome}
        />
      )}
    </div>
  );
};

export default QuizPage;
