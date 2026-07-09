import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  buildQuizSchema,
  TEMPLATE_NESSUNO,
} from '../../../validators/quizGestioneSchemas';
import { useCreateQuiz, useUpdateQuiz } from '../../../hooks/useQuizGestione';
import { useAuthStore, selectIsAdmin } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { STATI_QUIZ, DIMENSIONE_ROUND_DEFAULT } from '../../../constants/quizGestione';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import ScuolaSelect from '../../scuole/components/ScuolaSelect';
import styles from './QuizGestione.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'materia',
  'templateCodice',
  'stato',
  'dimensioneRound',
  'mescolaDomande',
  'scuolaId',
];

/**
 * Crea o modifica un quiz.
 *
 * In CREAZIONE si sceglie la natura del quiz:
 *   - un TEMPLATE di piattaforma (kana, kanji…) → le domande le genera il motore;
 *   - «personalizzato» → le domande le scrivono gli insegnanti, su ogni materia.
 * Il template è IMMUTABILE: in modifica il selettore è assente e il backend
 * rifiuta comunque il cambio (`QUIZ_TEMPLATE_IMMUTABILE`).
 *
 * `templateBloccato` preseleziona (e congela) il template: lo usa il catalogo,
 * dove il quiz nasce già come installazione di un template preciso.
 *
 * @param {Array} templates catalogo da `GET /quiz/templates`
 */
const QuizFormModal = ({
  isOpen,
  onClose,
  quiz = null,
  templates = [],
  templateBloccato = null,
}) => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(selectIsAdmin);
  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const isEdit = Boolean(quiz);
  const requireScuola = isAdmin && !isEdit;

  const codiciTemplate = useMemo(() => templates.map((x) => x.codice), [templates]);
  const templateScelto = useMemo(
    () => templates.find((x) => x.codice === templateBloccato) ?? null,
    [templates, templateBloccato]
  );

  const schema = useMemo(
    () => buildQuizSchema(t, { requireScuola, codiciTemplate }),
    [t, requireScuola, codiciTemplate]
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      titolo: quiz?.titolo ?? templateScelto?.nome ?? '',
      descrizione: quiz?.descrizione ?? templateScelto?.descrizione ?? '',
      materia: quiz?.materia ?? templateScelto?.materia ?? '',
      templateCodice: quiz?.templateCodice ?? templateBloccato ?? TEMPLATE_NESSUNO,
      stato: quiz?.stato ?? 'bozza',
      dimensioneRound: quiz?.dimensioneRound ?? DIMENSIONE_ROUND_DEFAULT,
      mescolaDomande: quiz?.mescolaDomande ?? true,
      scuolaId: quiz?.scuolaId ?? '',
    });
  }, [isOpen, quiz, templateBloccato, templateScelto, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      materia: values.materia ?? null,
      stato: values.stato,
      dimensioneRound: values.dimensioneRound ?? DIMENSIONE_ROUND_DEFAULT,
      mescolaDomande: Boolean(values.mescolaDomande),
    };

    try {
      if (isEdit) {
        // `templateCodice` volutamente omesso: è immutabile lato backend.
        await updateQuiz.mutateAsync({ id: quiz.id, ...payload });
        toast.success(t('quizGestione.toast.updated'));
      } else {
        const codice = templateBloccato ?? values.templateCodice;
        if (codice && codice !== TEMPLATE_NESSUNO) payload.templateCodice = codice;
        if (requireScuola && values.scuolaId) payload.scuolaId = values.scuolaId;
        await createQuiz.mutateAsync(payload);
        toast.success(t('quizGestione.toast.created'));
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (CAMPI.includes(field)) setError(field, { type: 'server', message });
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = createQuiz.isPending || updateQuiz.isPending;
  const mostraSelettoreTemplate = !isEdit && !templateBloccato && templates.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        isEdit
          ? t('quizGestione.form.editTitle')
          : templateScelto
            ? t('quizGestione.form.installTitle', { nome: templateScelto.nome })
            : t('quizGestione.form.createTitle')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="quiz-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('quizGestione.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="quiz-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <TextField
          label={t('quizGestione.form.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />

        <TextArea
          label={t('quizGestione.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />

        {mostraSelettoreTemplate && (
          <div>
            <Select
              label={t('quizGestione.form.template')}
              error={errors.templateCodice?.message}
              {...register('templateCodice')}
            >
              <option value={TEMPLATE_NESSUNO}>
                {t('quizGestione.form.templateNessuno')}
              </option>
              {templates.map((tpl) => (
                <option key={tpl.codice} value={tpl.codice}>
                  {tpl.nome}
                </option>
              ))}
            </Select>
            <p className={styles.opzioniHint}>{t('quizGestione.form.templateHint')}</p>
          </div>
        )}

        <div className={styles.formRow}>
          <TextField
            label={t('quizGestione.form.materia')}
            hint={t('quizGestione.form.materiaHint')}
            error={errors.materia?.message}
            {...register('materia')}
          />
          <Select
            label={t('quizGestione.form.stato')}
            required
            error={errors.stato?.message}
            {...register('stato')}
          >
            {STATI_QUIZ.map((stato) => (
              <option key={stato} value={stato}>
                {t(`corsi.stati.${stato}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.formRow}>
          <TextField
            type="number"
            label={t('quizGestione.form.dimensioneRound')}
            hint={t('quizGestione.form.dimensioneRoundHint')}
            error={errors.dimensioneRound?.message}
            {...register('dimensioneRound')}
          />
        </div>

        {requireScuola && (
          <ScuolaSelect required error={errors.scuolaId?.message} {...register('scuolaId')} />
        )}

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('mescolaDomande')} />
          <span className={styles.checkboxLabel}>
            <span className={styles.checkboxTitle}>
              {t('quizGestione.form.mescolaDomande')}
            </span>
            <span className={styles.checkboxHint}>
              {t('quizGestione.form.mescolaDomandeHint')}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
};

export default QuizFormModal;
