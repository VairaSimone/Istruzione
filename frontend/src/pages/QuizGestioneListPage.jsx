import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuizList, useTemplateQuiz } from '../hooks/useQuizGestione';
import {
  STATI_QUIZ,
  CODICI_TEMPLATE,
  FILTRO_PERSONALIZZATO,
} from '../constants/quizGestione';
import QuizCard from '../features/quizGestione/components/QuizCard';
import QuizFormModal from '../features/quizGestione/components/QuizFormModal';
import TemplateCatalogPanel from '../features/quizGestione/components/TemplateCatalogPanel';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Spinner from '../components/ui/Spinner';
import styles from '../features/quizGestione/components/QuizGestione.module.css';

const LIMIT = 12;

/**
 * Gestione dei quiz della propria scuola (staff).
 *
 * In testa il catalogo dei TEMPLATE installabili (il giapponese è uno di essi);
 * sotto, l'elenco dei quiz della scuola — installazioni di template e quiz
 * personalizzati su qualunque materia. Ogni insegnante gestisce tutti i quiz
 * della scuola, non solo i propri.
 */
const QuizGestioneListPage = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ q: '', stato: '', template: '', materia: '' });
  const [page, setPage] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);

  const queryFilters = {
    ...(filters.q && { q: filters.q }),
    ...(filters.stato && { stato: filters.stato }),
    ...(filters.template && { template: filters.template }),
    ...(filters.materia && { materia: filters.materia }),
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useQuizList(queryFilters);
  const { data: templates } = useTemplateQuiz();
  const quiz = data?.quiz ?? [];
  const paginazione = data?.paginazione;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('quizGestione.list.title')}</h1>
          <p className={styles.pageSubtitle}>{t('quizGestione.list.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>{t('quizGestione.list.create')}</Button>
      </div>

      <TemplateCatalogPanel />

      <div className={styles.filters}>
        <TextField
          label={t('quizGestione.list.search')}
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          placeholder={t('quizGestione.list.searchPlaceholder')}
        />
        <TextField
          label={t('quizGestione.form.materia')}
          value={filters.materia}
          onChange={(e) => updateFilter('materia', e.target.value)}
        />
        <Select
          label={t('quizGestione.form.stato')}
          placeholder={t('quizGestione.list.allStates')}
          value={filters.stato}
          onChange={(e) => updateFilter('stato', e.target.value)}
        >
          {STATI_QUIZ.map((s) => (
            <option key={s} value={s}>
              {t(`corsi.stati.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('quizGestione.form.template')}
          placeholder={t('quizGestione.list.allTypes')}
          value={filters.template}
          onChange={(e) => updateFilter('template', e.target.value)}
        >
          <option value={FILTRO_PERSONALIZZATO}>
            {t('quizGestione.card.personalizzato')}
          </option>
          {CODICI_TEMPLATE.map((codice) => (
            <option key={codice} value={codice}>
              {t(`quizGestione.templates.${codice}`)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('quizGestione.list.loadError')}</p>}

      {!isLoading && !isError && quiz.length === 0 && (
        <p className={styles.emptyText}>{t('quizGestione.list.empty')}</p>
      )}

      {quiz.length > 0 && (
        <div className={styles.grid}>
          {quiz.map((q) => (
            <QuizCard key={q.id} quiz={q} />
          ))}
        </div>
      )}

      {paginazione && paginazione.totalePagine > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className={styles.pageInfo}>
            {t('common.pageOf', {
              page: paginazione.paginaCorrente,
              total: paginazione.totalePagine,
            })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= paginazione.totalePagine}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      <QuizFormModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        templates={templates ?? []}
      />
    </div>
  );
};

export default QuizGestioneListPage;
