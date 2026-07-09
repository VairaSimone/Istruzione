import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuizDettaglio, useDeleteQuiz, useTemplateQuiz } from '../hooks/useQuizGestione';
import { ROUTES } from '../constants/routes';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { STATO_QUIZ_TONE } from '../constants/quizGestione';
import QuizFormModal from '../features/quizGestione/components/QuizFormModal';
import ConfigurazioneTemplatePanel from '../features/quizGestione/components/ConfigurazioneTemplatePanel';
import DomandeQuizPanel from '../features/quizGestione/components/DomandeQuizPanel';
import QuizAulePanel from '../features/quizGestione/components/QuizAulePanel';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/quizGestione/components/QuizGestione.module.css';

/**
 * Dettaglio di un quiz (staff).
 *
 * Un quiz DA TEMPLATE espone la configurazione del motore (che la scuola può
 * fissare o lasciare libera) e non ha domande in database. Un quiz
 * PERSONALIZZATO espone invece l'editor delle domande. In entrambi i casi si
 * gestiscono le aule per cui è abilitato.
 */
const QuizGestioneDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quiz, isLoading, isError } = useQuizDettaglio(id);
  const { data: templates } = useTemplateQuiz();
  const deleteQuiz = useDeleteQuiz();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('quizGestione.detail.deleteConfirm'))) return;
    try {
      await deleteQuiz.mutateAsync(id);
      toast.success(t('quizGestione.toast.deleted'));
      navigate(ROUTES.QUIZ_GESTIONE);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !quiz)
    return <p className={styles.emptyText}>{t('quizGestione.detail.loadError')}</p>;

  const daTemplate = Boolean(quiz.templateCodice);
  const configurazione = quiz.configurazione ?? {};
  const campiFissati = Object.keys(configurazione);

  return (
    <div>
      <Link to={ROUTES.QUIZ_GESTIONE} className={styles.backLink}>
        {t('quizGestione.detail.back')}
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageTitle}>{quiz.titolo}</h1>
          {quiz.descrizione && <p className={styles.pageSubtitle}>{quiz.descrizione}</p>}
          <div className={styles.cardMeta}>
            <Badge tone={STATO_QUIZ_TONE[quiz.stato] || 'neutral'}>
              {t(`corsi.stati.${quiz.stato}`)}
            </Badge>
            {daTemplate ? (
              <Badge tone="seal">{t(`quizGestione.templates.${quiz.templateCodice}`)}</Badge>
            ) : (
              <Badge tone="neutral">{t('quizGestione.card.personalizzato')}</Badge>
            )}
            {quiz.materia && <Badge tone="neutral">{quiz.materia}</Badge>}
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteQuiz.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <Card>
        <div className={styles.statsRow}>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>
              {daTemplate ? '—' : (quiz.conteggioDomande ?? 0)}
            </span>
            <span className={styles.statLabel}>{t('quizGestione.detail.statDomande')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{quiz.dimensioneRound}</span>
            <span className={styles.statLabel}>{t('quizGestione.detail.statRound')}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statValue}>{quiz.auleAbilitate?.length ?? 0}</span>
            <span className={styles.statLabel}>{t('quizGestione.detail.statAule')}</span>
          </div>
        </div>

        {daTemplate && campiFissati.length > 0 && (
          <div className={styles.configList} style={{ marginTop: 'var(--space-5)' }}>
            {campiFissati.map((campo) => (
              <span key={campo} className={styles.configChip}>
                <span className={styles.configKey}>{campo}</span>
                <span className={styles.configValue}>
                  {Array.isArray(configurazione[campo])
                    ? configurazione[campo].join(', ')
                    : String(configurazione[campo])}
                </span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className={styles.panels}>
        {daTemplate ? (
          <ConfigurazioneTemplatePanel key={quiz.updated_at} quiz={quiz} />
        ) : (
          <DomandeQuizPanel quiz={quiz} />
        )}
        <QuizAulePanel quiz={quiz} />
      </div>

      <QuizFormModal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        quiz={quiz}
        templates={templates ?? []}
      />
    </div>
  );
};

export default QuizGestioneDetailPage;
