import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCompitoSchema } from '../../../validators/compitiSchemas';
import { useCreateCompito, useUpdateCompito } from '../../../hooks/useCompiti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { toDatetimeLocal, fromDatetimeLocal } from '../../../utils/datetime';
import {
  TIPI_ATTIVITA_COMPITO,
  STATI_COMPITO,
  ALFABETI_KANA,
  LIVELLI_JLPT,
} from '../../../constants/domain';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

const CAMPI = ['titolo', 'descrizione', 'tipoAttivita', 'dataScadenza', 'tempoLimiteMinuti', 'punteggioMassimo', 'stato'];

/** Costruisce l'oggetto `configurazione` dai campi condizionali del form. */
const buildConfigurazione = (values) => {
  const cfg = {};
  if (values.tipoAttivita === 'quiz_kana' && values.alfabeto) cfg.alfabeto = values.alfabeto;
  if (values.tipoAttivita === 'quiz_kanji' && values.livelloJLPT) cfg.livelloJLPT = values.livelloJLPT;
  if (
    (values.tipoAttivita === 'quiz_kana' || values.tipoAttivita === 'quiz_kanji') &&
    values.numeroDomande
  ) {
    cfg.numeroDomande = values.numeroDomande;
  }
  return Object.keys(cfg).length ? cfg : null;
};

const CompitoFormModal = ({ isOpen, onClose, compito = null }) => {
  const { t } = useTranslation();
  const createCompito = useCreateCompito();
  const updateCompito = useUpdateCompito();
  const isEdit = Boolean(compito);

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

  useEffect(() => {
    if (!isOpen) return;
    const cfg = compito?.configurazione || {};
    reset({
      titolo: compito?.titolo ?? '',
      descrizione: compito?.descrizione ?? '',
      tipoAttivita: compito?.tipoAttivita ?? '',
      dataScadenza: toDatetimeLocal(compito?.dataScadenza) ?? '',
      tempoLimiteMinuti: compito?.tempoLimiteMinuti ?? '',
      punteggioMassimo: compito?.punteggioMassimo ?? 100,
      stato: compito?.stato ?? 'bozza',
      alfabeto: cfg.alfabeto ?? '',
      livelloJLPT: cfg.livelloJLPT ?? '',
      numeroDomande: cfg.numeroDomande ?? '',
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
  const isQuiz = tipoAttivita === 'quiz_kana' || tipoAttivita === 'quiz_kanji';

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
            {TIPI_ATTIVITA_COMPITO.map((tipo) => (
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

        {/* Configurazione attività (condizionale) */}
        {isQuiz && (
          <div className={styles.configBox}>
            <span className={styles.configTitle}>{t('compiti.form.configTitle')}</span>
            <div className={styles.formRow}>
              {tipoAttivita === 'quiz_kana' && (
                <Select
                  label={t('compiti.form.alfabeto')}
                  placeholder={t('compiti.form.qualsiasi')}
                  {...register('alfabeto')}
                >
                  {ALFABETI_KANA.map((a) => (
                    <option key={a} value={a}>
                      {t(`compiti.alfabeti.${a}`)}
                    </option>
                  ))}
                </Select>
              )}
              {tipoAttivita === 'quiz_kanji' && (
                <Select
                  label={t('compiti.form.livelloJLPT')}
                  placeholder={t('compiti.form.qualsiasi')}
                  {...register('livelloJLPT')}
                >
                  {LIVELLI_JLPT.map((liv) => (
                    <option key={liv} value={liv}>
                      {liv}
                    </option>
                  ))}
                </Select>
              )}
              <TextField
                label={t('compiti.form.numeroDomande')}
                type="number"
                min="1"
                max="200"
                error={errors.numeroDomande?.message}
                {...register('numeroDomande')}
              />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default CompitoFormModal;
