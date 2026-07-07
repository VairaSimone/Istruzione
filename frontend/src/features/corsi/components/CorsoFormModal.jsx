import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCorsoSchema } from '../../../validators/corsiSchemas';
import { useCreateCorso, useUpdateCorso } from '../../../hooks/useCorsi';
import { useAuthStore, selectIsAdmin } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { LIVELLI_JLPT, STATI_CORSO } from '../../../constants/domain';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import ScuolaSelect from '../../scuole/components/ScuolaSelect';
import styles from './Corsi.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'copertinaUrl',
  'livelloJLPT',
  'stato',
  'scuolaId',
];

/**
 * Crea o modifica un corso. In creazione, un admin deve indicare la scuola
 * (l'insegnante usa la propria, gestita dal backend). La scuola NON è
 * modificabile dopo la creazione (il backend non accetta il cambio tenant).
 */
const CorsoFormModal = ({ isOpen, onClose, corso = null }) => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(selectIsAdmin);
  const createCorso = useCreateCorso();
  const updateCorso = useUpdateCorso();
  const isEdit = Boolean(corso);
  const requireScuola = isAdmin && !isEdit;

  const schema = useMemo(
    () => buildCorsoSchema(t, { requireScuola }),
    [t, requireScuola]
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
      titolo: corso?.titolo ?? '',
      descrizione: corso?.descrizione ?? '',
      copertinaUrl: corso?.copertinaUrl ?? '',
      livelloJLPT: corso?.livelloJLPT ?? '',
      stato: corso?.stato ?? 'bozza',
      videoScaricabile: corso?.videoScaricabile ?? false,
      scuolaId: corso?.scuolaId ?? '',
    });
  }, [isOpen, corso, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      copertinaUrl: values.copertinaUrl ?? null,
      livelloJLPT: values.livelloJLPT ?? null,
      stato: values.stato,
      videoScaricabile: Boolean(values.videoScaricabile),
    };

    try {
      if (isEdit) {
        await updateCorso.mutateAsync({ id: corso.id, ...payload });
        toast.success(t('corsi.toast.updated'));
      } else {
        if (requireScuola && values.scuolaId) payload.scuolaId = values.scuolaId;
        await createCorso.mutateAsync(payload);
        toast.success(t('corsi.toast.created'));
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

  const isPending = createCorso.isPending || updateCorso.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('corsi.form.editTitle') : t('corsi.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="corso-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('corsi.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="corso-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <TextField
          label={t('corsi.form.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <TextArea
          label={t('corsi.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />
        <TextField
          label={t('corsi.form.copertinaUrl')}
          hint={t('corsi.form.copertinaHint')}
          error={errors.copertinaUrl?.message}
          {...register('copertinaUrl')}
        />
        <div className={styles.formRow}>
          <Select
            label={t('corsi.form.livelloJLPT')}
            placeholder={t('corsi.form.livelloQualsiasi')}
            error={errors.livelloJLPT?.message}
            {...register('livelloJLPT')}
          >
            {LIVELLI_JLPT.map((liv) => (
              <option key={liv} value={liv}>
                {liv}
              </option>
            ))}
          </Select>
          <Select
            label={t('corsi.form.stato')}
            required
            error={errors.stato?.message}
            {...register('stato')}
          >
            {STATI_CORSO.map((stato) => (
              <option key={stato} value={stato}>
                {t(`corsi.stati.${stato}`)}
              </option>
            ))}
          </Select>
        </div>

        {requireScuola && (
          <ScuolaSelect
            required
            error={errors.scuolaId?.message}
            {...register('scuolaId')}
          />
        )}

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('videoScaricabile')} />
          <span className={styles.checkboxLabel}>
            <span className={styles.checkboxTitle}>
              {t('corsi.form.videoScaricabile')}
            </span>
            <span className={styles.checkboxHint}>
              {t('corsi.form.videoScaricabileHint')}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
};

export default CorsoFormModal;
