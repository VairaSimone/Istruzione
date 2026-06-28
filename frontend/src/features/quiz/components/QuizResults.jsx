import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import styles from './QuizResults.module.css';

/**
 * Schermata dei risultati di fine partita (presentazionale).
 * Mostra l'esito del round, il dettaglio degli XP guadagnati, l'eventuale
 * salita di livello e le statistiche aggiornate restituite dal backend.
 *
 * @param {Object} risultatoRound  da POST /quiz/submit (risultatoRound)
 * @param {Object} statistiche     statistiche aggiornate
 * @param {() => void} onPlayAgain
 * @param {() => void} onBackToDashboard
 */
const QuizResults = ({ risultatoRound, statistiche, onPlayAgain, onBackToDashboard }) => {
  const { t } = useTranslation();

  const {
    corrette = 0,
    errate = 0,
    totale = 0,
    percentuale = 0,
    xpGuadagnati = 0,
    xpRisposte = 0,
    bonusCombo = 0,
    bonusPercentuale = 0,
    livelloPrima = 1,
    livelloDopo = 1,
    salitoDiLivello = false,
  } = risultatoRound ?? {};

  const toneEsito = percentuale === 100 ? 'matcha' : percentuale >= 80 ? 'gold' : 'seal';

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{t('quiz.results.title')}</span>
        <div className={styles.score}>{percentuale}%</div>
        <Badge tone={toneEsito}>
          {t('quiz.results.correctOfTotal', { correct: corrette, total: totale })}
        </Badge>
      </header>

      {salitoDiLivello && (
        <div className={styles.levelUp} role="status">
          {t('quiz.results.levelUp', { from: livelloPrima, to: livelloDopo })}
        </div>
      )}

      {/* Dettaglio guadagni */}
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>{t('quiz.results.xpFromAnswers')}</span>
          <span className={styles.breakdownValue}>+{xpRisposte}</span>
        </div>
        {bonusCombo > 0 && (
          <div className={styles.breakdownRow}>
            <span>{t('quiz.results.xpCombo')}</span>
            <span className={styles.breakdownValue}>+{bonusCombo}</span>
          </div>
        )}
        {bonusPercentuale > 0 && (
          <div className={styles.breakdownRow}>
            <span>{t('quiz.results.xpAccuracy')}</span>
            <span className={styles.breakdownValue}>+{bonusPercentuale}</span>
          </div>
        )}
        <div className={[styles.breakdownRow, styles.breakdownTotal].join(' ')}>
          <span>{t('quiz.results.xpTotal')}</span>
          <span className={styles.breakdownValue}>+{xpGuadagnati} XP</span>
        </div>
      </div>

      {/* Riepilogo corrette/errate + statistiche aggiornate */}
      <dl className={styles.summary}>
        <div className={styles.summaryItem}>
          <dt>{t('quiz.results.correct')}</dt>
          <dd className={styles.correct}>{corrette}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>{t('quiz.results.wrong')}</dt>
          <dd className={styles.wrong}>{errate}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>{t('quiz.stats.level')}</dt>
          <dd>{statistiche?.livello ?? livelloDopo}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>{t('quiz.stats.streak')}</dt>
          <dd>{statistiche?.streak ?? 0}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Button size="lg" fullWidth onClick={onPlayAgain}>
          {t('quiz.results.playAgain')}
        </Button>
        <Button size="lg" variant="secondary" fullWidth onClick={onBackToDashboard}>
          {t('quiz.results.backToDashboard')}
        </Button>
      </div>
    </Card>
  );
};

export default QuizResults;
