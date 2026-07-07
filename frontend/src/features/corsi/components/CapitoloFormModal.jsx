import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCapitoloSchema } from '../../../validators/corsiSchemas';
import { useAddCapitolo, useUpdateCapitolo } from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Corsi.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'videoUrl',
  'videoDurataSecondi',
  'scaricabile',
  'ordine',
];

// Override tri-stato → valore inviato al backend:
//   'eredita' → null (eredita dal corso); 'si' → true; 'no' → false.
const overrideToBackend = (v) => (v === 'si' ? true : v === 'no' ? false : null);
const overrideFromBackend = (v) => (v === true ? 'si' : v === false ? 'no' : 'eredita');

/** Crea o modifica un capitolo del corso indicato (`corsoId`). */
const CapitoloFormModal = ({ isOpen, onClose, corsoId, capitolo = null }) => {
  const { t } = useTranslation();
  const addCapitolo = useAddCapitolo();
  const updateCapitolo = useUpdateCapitolo();
  const isEdit = Boolean(capitolo);

  const schema = useMemo(() => buildCapitoloSchema(t), [t]);
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
      titolo: capitolo?.titolo ?? '',
      descrizione: capitolo?.descrizione ?? '',
      videoUrl: capitolo?.videoUrl ?? '',
      videoDurataSecondi: capitolo?.videoDurataSecondi ?? '',
      scaricabile: overrideFromBackend(capitolo?.scaricabile),
      ordine: capitolo?.ordine ?? '',
    });
  }, [isOpen, capitolo, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      videoUrl: values.videoUrl ?? null,
      videoDurataSecondi: values.videoDurataSecondi ?? null,
      scaricabile: overrideToBackend(values.scaricabile),
    };
    if (values.ordine !== undefined) payload.ordine = values.ordine;

    try {
      if (isEdit) {
        await updateCapitolo.mutateAsync({
          id: corsoId,
          capitoloId: capitolo.id,
          ...payload,
        });
        toast.success(t('corsi.toast.capitoloUpdated'));
      } else {
        await addCapitolo.mutateAsync({ id: corsoId, ...payload });
        toast.success(t('corsi.toast.capitoloAdded'));
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

  const isPending = addCapitolo.isPending || updateCapitolo.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        isEdit ? t('corsi.capitoloForm.editTitle') : t('corsi.capitoloForm.createTitle')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="capitolo-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('corsi.capitoloForm.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="capitolo-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <TextField
          label={t('corsi.capitoloForm.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <TextArea
          label={t('corsi.capitoloForm.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />
        <TextField
          label={t('corsi.capitoloForm.videoUrl')}
          hint={t('corsi.capitoloForm.videoUrlHint')}
          error={errors.videoUrl?.message}
          {...register('videoUrl')}
        />
        <div className={styles.formRow}>
          <TextField
            label={t('corsi.capitoloForm.videoDurata')}
            type="number"
            min="0"
            max="86400"
            hint={t('corsi.capitoloForm.videoDurataHint')}
            error={errors.videoDurataSecondi?.message}
            {...register('videoDurataSecondi')}
          />
          <TextField
            label={t('corsi.capitoloForm.ordine')}
            type="number"
            min="0"
            hint={t('corsi.capitoloForm.ordineHint')}
            error={errors.ordine?.message}
            {...register('ordine')}
          />
        </div>
        <Select
          label={t('corsi.capitoloForm.scaricabile')}
          placeholder={t('corsi.capitoloForm.scaricabile')}
          error={errors.scaricabile?.message}
          {...register('scaricabile')}
        >
          <option value="eredita">{t('corsi.capitoloForm.scaricabileEredita')}</option>
          <option value="si">{t('corsi.capitoloForm.scaricabileSi')}</option>
          <option value="no">{t('corsi.capitoloForm.scaricabileNo')}</option>
        </Select>
      </form>
    </Modal>
  );
};

export default CapitoloFormModal;
