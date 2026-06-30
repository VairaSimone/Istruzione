import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './QuizStatsPanel.module.css';

/**
 * Pannello statistiche del Quiz Kana (presentazionale).
 * Mostra livello + barra di avanzamento XP, streak, record, kana
 * padroneggiati e i caratteri da rivedere. I dati arrivano già pronti dal
 * backend (GET /quiz/dashboard, serializzaStatistiche).
 *
 * @param {Object} statistiche  { xp, streak, punteggioRecord, livello, xpInizioLivello, xpProssimoLivello, progressoLivello }
 * @param {number} mastered     numero di kana con punteggio massimo (5)
 * @param {Array<{kana:string, tipo:string, punteggio:number}>} peggioriKana
 */
const QuizStatsPanel = ({ statistiche, mastered = 0, peggioriKana = [] }) => {
  const { t } = useTranslation();

  const {
    xp = 0,
    streak = 0,
    streakRecord = 0,
    punteggioRecord = 0,
    livello = 1,
    xpProssimoLivello = 100,
    progressoLivello = 0,
  } = statistiche ?? {};

  return (
    <div className={styles.wrapper}>
      <Card className={styles.levelCard}>
        <div className={styles.levelHeader}>
          <span className={styles.levelLabel}>{t('quiz.stats.level')}</span>
          <span className={styles.levelValue}>{livello}</span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progressoLivello}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('quiz.stats.levelProgress')}
        >
          <div className={styles.progressFill} style={{ width: `${progressoLivello}%` }} />
        </div>
        <p className={styles.xpText}>
          {t('quiz.stats.xpProgress', { xp, next: xpProssimoLivello })}
        </p>
      </Card>

      <div className={styles.metrics}>
        <Card className={styles.metricCard}>
          <span className={styles.metricValue}>
            {streak}
            <span className={styles.metricUnit} aria-hidden="true">
              {' '}
              🔥
            </span>
          </span>
          <span className={styles.metricLabel}>{t('quiz.stats.streak')}</span>
          {streakRecord > 0 && (
            <span className={styles.metricSub}>
              {t('quiz.stats.streakRecord', { count: streakRecord })}
            </span>
          )}
        </Card>

        <Card className={styles.metricCard}>
          <span className={styles.metricValue}>{punteggioRecord}%</span>
          <span className={styles.metricLabel}>{t('quiz.stats.record')}</span>
        </Card>

        <Card className={styles.metricCard}>
          <span className={styles.metricValue}>{mastered}</span>
          <span className={styles.metricLabel}>{t('quiz.stats.mastered')}</span>
        </Card>
      </div>

      <Card className={styles.reviewCard}>
        <h3 className={styles.reviewTitle}>{t('quiz.stats.toReviewTitle')}</h3>
        {peggioriKana.length === 0 ? (
          <p className={styles.reviewEmpty}>{t('quiz.stats.toReviewEmpty')}</p>
        ) : (
          <ul className={styles.reviewList}>
            {peggioriKana.map((p) => (
              <li key={`${p.tipo}:${p.kana}`} className={styles.reviewItem}>
                <span className={styles.reviewKana}>{p.kana}</span>
                <Badge tone={p.punteggio === 0 ? 'danger' : 'seal'}>{p.punteggio}/5</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default QuizStatsPanel;
