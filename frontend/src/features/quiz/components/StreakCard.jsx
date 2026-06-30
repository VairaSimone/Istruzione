import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Spinner from '../../../components/ui/Spinner';
import { useStreak } from '../../../hooks/useStreak';
import styles from './StreakCard.module.css';

/**
 * StreakCard — stato della streak di studio (GET /statistiche/streak).
 *
 * Mostra la striscia di giorni consecutivi con messaggio "fuoco", il primato
 * personale e, quando la streak è a rischio (studio fatto ieri ma non oggi),
 * un invito a studiare per non perderla.
 *
 * Componente non critico: in caricamento mostra uno spinner compatto, in errore
 * non rende nulla (la home resta utilizzabile).
 */
const StreakCard = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useStreak();

  if (isError) return null;

  if (isLoading || !data) {
    return (
      <Card className={styles.card}>
        <Spinner label={t('common.loading')} />
      </Card>
    );
  }

  const { streak = 0, streakRecord = 0, attivaOggi = false, aRischio = false } = data;
  const acceso = streak > 0;

  return (
    <Card className={[styles.card, acceso ? styles.acceso : ''].join(' ')}>
      <div className={styles.intestazione}>
        <span className={styles.fiamma} aria-hidden="true">
          {acceso ? '🔥' : '🌱'}
        </span>
        <div className={styles.numeri}>
          <span className={styles.valore}>{streak}</span>
          <span className={styles.unita}>{t('quiz.streak.daysUnit', { count: streak })}</span>
        </div>
      </div>

      <p className={styles.messaggio}>
        {acceso ? t('quiz.streak.flame', { count: streak }) : t('quiz.streak.none')}
      </p>

      <div className={styles.piede}>
        <span className={styles.record}>
          {t('quiz.streak.record', { count: streakRecord })}
        </span>

        {attivaOggi && (
          <span className={[styles.stato, styles.statoOk].join(' ')}>
            {t('quiz.streak.studiedToday')}
          </span>
        )}
        {!attivaOggi && aRischio && (
          <span className={[styles.stato, styles.statoRischio].join(' ')}>
            {t('quiz.streak.atRisk')}
          </span>
        )}
      </div>
    </Card>
  );
};

export default StreakCard;
