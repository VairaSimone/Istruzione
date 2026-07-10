import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCompitoSchema, buildConfigurazione } from '../../../validators/compitiSchemas';
import { useCreateCompito, useUpdateCompito } from '../../../hooks/useCompiti';
import { useQuizList } from '../../../hooks/useQuizGestione';
import { useCorsiList } from '../../../hooks/useCorsi';
import { useFunzionalitaAttiva } from '../../../hooks/useConfig';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { toDatetimeLocal, fromDatetimeLocal } from '../../../utils/datetime';
import { STATI_COMPITO } from '../../../constants/domain';
import {
  CODICI_ATTIVITA,
  TIPI_ATTIVITA,
  normalizzaTipoAttivita,
} from '../../../constants/tipiAttivita';
import { FUNZIONALITA } from '../../../constants/funzionalita';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'tipoAttivita',
  'dataScadenza',
  'tempoLimiteMinuti',
  'punteggioMassimo',
  'stato',
];

/**
 * Crea o modifica un COMPITO.
 *
 * Il tipo di attività viene dal registro `constants/tipiAttivita.js`: codici
 * neutri (`quiz`, `corso`, `pratica_scrittura`, `lettura`, `consegna`,
 * `personalizzato`), non più i vecchi `quiz_kana`/`quiz_kanji`. Un compito di
 * tipo `quiz` punta a un quiz REALE della scuola — che sia l'installazione di
 * un template di giapponese o un quiz di matematica scritto a mano, al compito
 * non interessa.
 *
 * I tipi la cui sezione è disattivata per la scuola non vengono proposti: non
 * ha senso assegnare un corso a una scuola che non usa i corsi.
 */
const CompitoFormModal = ({ isOpen, onClose, compito = null }) => {
  const { t } = useTranslation();
  const createCompito = useCreateCompito();
  const updateCompito = useUpdateCompito();
  const isEdit = Boolean(compito);

  const quizAttivi = useFunzionalitaAttiva(FUNZIONALITA.QUIZ);
  const corsiAttivi = useFunzionalitaAttiva(FUNZIONALITA.CORSI);
  const scritturaAttiva = useFunzionalitaAttiva(FUNZIONALITA.PRATICA_SCRITTURA);

  const schema = useMemo(() => buildCompitoSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const tipoAttivita = useWatch({ control, name: 'tipoAttivita' });

  // Gli elenchi si caricano solo quando servono davvero al tipo selezionato.
  const { data: quizData } = useQuizList(
    tipoAttivita === TIPI_ATTIVITA.QUIZ ? { stato: 'pubblicato', limit: 100 } : {}
  );
  const { data: corsiData } = useCorsiList(
    tipoAttivita === TIPI_ATTIVITA.CORSO ? { stato: 'pubblicato', limit: 100 } : {}
  );

  const quiz = quizData?.quiz ?? [];
  const corsi = corsiData?.corsi ?? [];

  /** Tipi proponibili: nascondiamo quelli la cui sezione è spenta. */
  const tipiDisponibili = useMemo(
    () =>
      CODICI_ATTIVITA.filter((codice) => {
        if (codice === TIPI_ATTIVITA.QUIZ) return quizAttivi;
        if (codice === TIPI_ATTIVITA.CORSO) return corsiAttivi;
        if (codice === TIPI_ATTIVITA.PRATICA_SCRITTURA) return scritturaAttiva;
        return true;
      }),
    [quizAttivi, corsiAttivi, scritturaAttiva]
  );

  useEffect(() => {
    if (!isOpen) return;
    const cfg = compito?.configurazione || {};
    reset({
      titolo: compito?.titolo ?? '',
      descrizione: compito?.descrizione ?? '',
      // I compiti creati prima della generalizzazione portano ancora i codici
      // storici: li traduciamo in lettura, così il <select> li riconosce.
      tipoAttivita: compito?.tipoAttivita
        ? normalizzaTipoAttivita(compito.tipoAttivita)
        : '',
      dataScadenza: toDatetimeLocal(compito?.dataScadenza) ?? '',
      tempoLimiteMinuti: compito?.tempoLimiteMinuti ?? '',
      punteggioMassimo: compito?.punteggioMassimo ?? 100,
      stato: compito?.stato ?? 'bozza',
      quizId: cfg.quizId ?? '',
      corsoId: cfg.corsoId ?? '',
      numeroDomande: cfg.numeroDomande ?? '',
      istruzioni: cfg.istruzioni ?? '',
    });
  }, [isOpen, compito, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      tipoAttivita: values.tipoAttivita,
      dataScadenza: fromDatetimeLocal(values.dataScadenza),
      tempoLimiteMinuti: values.tempoLimiteMinuti ?? null,
      punteggioMassimo: values.punteggioMassimo ?? 100,
      stato: values.stato,
      configurazione: buildConfigurazione(values),
    };

    try {
      if (isEdit) {
        await updateCompito.mutateAsync({ id: compito.id, ...payload });
        toast.success(t('compiti.toast.updated'));
      } else {
        await createCompito.mutateAsync(payload);
        toast.success(t('compiti.toast.created'));
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

  const isPending = createCompito.isPending || updateCompito.isPending;
  const isQuiz = tipoAttivita === TIPI_ATTIVITA.QUIZ;
  const isCorso = tipoAttivita === TIPI_ATTIVITA.CORSO;
  const mostraConfig = Boolean(tipoAttivita);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('compiti.form.editTitle') : t('compiti.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="compito-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('compiti.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form id="compito-form" onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <TextField
          label={t('compiti.form.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <TextArea
          label={t('compiti.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />
        <div className={styles.formRow}>
          <Select
            label={t('compiti.form.tipoAttivita')}
            required
            placeholder={t('compiti.form.tipoPlaceholder')}
            error={errors.tipoAttivita?.message}
            {...register('tipoAttivita')}
          >
            {tipiDisponibili.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t(`compiti.tipi.${tipo}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('compiti.form.stato')}
            required
            error={errors.stato?.message}
            {...register('stato')}
          >
            {STATI_COMPITO.map((stato) => (
              <option key={stato} value={stato}>
                {t(`compiti.stati.${stato}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.formRow}>
          <TextField
            label={t('compiti.form.dataScadenza')}
            type="datetime-local"
            required
            error={errors.dataScadenza?.message}
            {...register('dataScadenza')}
          />
          <TextField
            label={t('compiti.form.punteggioMassimo')}
            type="number"
            min="1"
            max="1000"
            error={errors.punteggioMassimo?.message}
            {...register('punteggioMassimo')}
          />
        </div>
        <div className={styles.formRow}>
          <TextField
            label={t('compiti.form.tempoLimite')}
            type="number"
            min="1"
            max="1440"
            hint={t('compiti.form.tempoLimiteHint')}
            error={errors.tempoLimiteMinuti?.message}
            {...register('tempoLimiteMinuti')}
          />
        </div>

        {/* Configurazione dell'attività: dipende dal tipo selezionato. */}
        {mostraConfig && (
          <div className={styles.configBox}>
            <span className={styles.configTitle}>{t('compiti.form.configTitle')}</span>
            <p className={styles.configHint}>{t(`compiti.tipiDescrizione.${tipoAttivita}`)}</p>

            {isQuiz && (
              <div className={styles.formRow}>
                <Select
                  label={t('compiti.form.quiz')}
                  required
                  placeholder={
                    quiz.length === 0
                      ? t('compiti.form.quizVuoto')
                      : t('compiti.form.quizPlaceholder')
                  }
                  disabled={quiz.length === 0}
                  error={errors.quizId?.message}
                  {...register('quizId')}
                >
                  {quiz.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.titolo}
                      {q.materia ? ` — ${q.materia}` : ''}
                    </option>
                  ))}
                </Select>
                <TextField
                  label={t('compiti.form.numeroDomande')}
                  type="number"
                  min="1"
                  max="200"
                  hint={t('compiti.form.numeroDomandeHint')}
                  error={errors.numeroDomande?.message}
                  {...register('numeroDomande')}
                />
              </div>
            )}

            {isCorso && (
              <Select
                label={t('compiti.form.corso')}
                required
                placeholder={
                  corsi.length === 0
                    ? t('compiti.form.corsoVuoto')
                    : t('compiti.form.corsoPlaceholder')
                }
                disabled={corsi.length === 0}
                error={errors.corsoId?.message}
                {...register('corsoId')}
              >
                {corsi.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titolo}
                  </option>
                ))}
              </Select>
            )}

            <TextArea
              label={t('compiti.form.istruzioni')}
              rows={2}
              hint={t('compiti.form.istruzioniHint')}
              error={errors.istruzioni?.message}
              {...register('istruzioni')}
            />
          </div>
        )}
      </form>
    </Modal>
  );
};

export default CompitoFormModal;
