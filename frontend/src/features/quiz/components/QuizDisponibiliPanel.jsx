import { useTranslation } from 'react-i18next';
import { useQuizDisponibili } from '../../../hooks/useQuizGestione';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import styles from './QuizDisponibiliPanel.module.css';

/**
 * Quiz assegnati dalla scuola, giocabili dal richiedente.
 *
 *   - studente   → solo i quiz pubblicati e abilitati per una sua aula;
 *   - insegnante → tutti i quiz della propria scuola (anche in bozza: anteprima).
 *
 * Un quiz può essere l'installazione di un template (giapponese: kana/kanji) o
 * un quiz personalizzato su qualsiasi materia. Il pannello non compare quando
 * non c'è nulla da giocare, per non aggiungere rumore alla home.
 *
 * @param {(quiz:Object) => void} onStartQuiz
 */
const QuizDisponibiliPanel = ({ onStartQuiz, isStarting = false }) => {
  const { t } = useTranslation();
  const { data: quiz, isLoading, isError } = useQuizDisponibili();

  if (isLoading) return <Spinner />;
  if (isError || !quiz || quiz.length === 0) return null;

  return (
    <section className={styles.section} aria-label={t('quiz.disponibili.title')}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('quiz.disponibili.title')}</h2>
        <p className={styles.subtitle}>{t('quiz.disponibili.subtitle')}</p>
      </div>

      <div className={styles.grid}>
        {quiz.map((q) => (
          <Card key={q.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{q.titolo}</span>
              {q.materia && <Badge tone="neutral">{q.materia}</Badge>}
            </div>

            {q.descrizione && <p className={styles.cardDesc}>{q.descrizione}</p>}

            <div className={styles.cardFoot}>
              <span className={styles.meta}>
                {q.templateCodice
                  ? t(`quizGestione.templates.${q.templateCodice}`)
                  : t('quiz.disponibili.domande', { n: q.conteggioDomande ?? 0 })}
              </span>
              <Button size="sm" onClick={() => onStartQuiz(q)} disabled={isStarting}>
                {t('quiz.disponibili.play')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default QuizDisponibiliPanel;
