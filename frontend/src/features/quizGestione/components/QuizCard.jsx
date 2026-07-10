import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { quizGestioneDetailPath } from '../../../constants/routes';
import { STATO_QUIZ_TONE } from '../../../constants/quizGestione';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import styles from './QuizGestione.module.css';

/**
 * Card di riepilogo di un quiz nella lista dello staff.
 *
 * Un quiz da template mostra il nome del template al posto del conteggio delle
 * domande: le sue domande le genera il motore, non esistono righe in database
 * (`conteggioDomande` è `null`).
 */
const QuizCard = ({ quiz }) => {
  const { t } = useTranslation();
  const daTemplate = Boolean(quiz.templateCodice);

  return (
    <Card as={Link} to={quizGestioneDetailPath(quiz.id)} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{quiz.titolo}</h3>
        <Badge tone={STATO_QUIZ_TONE[quiz.stato] || 'neutral'}>
          {t(`corsi.stati.${quiz.stato}`)}
        </Badge>
      </div>

      {quiz.descrizione && <p className={styles.cardDesc}>{quiz.descrizione}</p>}

      <div className={styles.cardMeta}>
        {daTemplate ? (
          <Badge tone="seal">{t(`quizGestione.templates.${quiz.templateCodice}`)}</Badge>
        ) : (
          <Badge tone="neutral">{t('quizGestione.card.personalizzato')}</Badge>
        )}
        {quiz.materia && <Badge tone="gold">{quiz.materia}</Badge>}
        {quiz.categoria && <Badge tone="neutral">{quiz.categoria}</Badge>}
      </div>

      <div className={styles.cardStats}>
        {daTemplate
          ? t('quizGestione.card.generatoDalMotore')
          : t('quizGestione.card.domande', { n: quiz.conteggioDomande ?? 0 })}
        {' · '}
        {t('quizGestione.card.round', { n: quiz.dimensioneRound })}
      </div>
    </Card>
  );
};

export default QuizCard;
