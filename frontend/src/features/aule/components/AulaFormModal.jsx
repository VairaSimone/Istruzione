import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildAulaSchema } from '../../../validators/auleSchemas';
import { useCreateAula, useUpdateAula } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { LIVELLI_JLPT } from '../../../constants/domain';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Aule.module.css';

const CAMPI = ['nome', 'descrizione', 'annoScolastico', 'livelloJLPT', 'colore'];

/**
 * Modal per creare (aula = null) o modificare un'aula esistente.
 * I campi opzionali svuotati vengono inviati come `null` così da poterli
 * azzerare anche in modifica.
 */
const AulaFormModal = ({ isOpen, onClose, aula = null }) => {
  const { t } = useTranslation();
  const createAula = useCreateAula();
  const updateAula = useUpdateAula();
  const isEdit = Boolean(aula);

  const schema = useMemo(() => buildAulaSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  // Precompila (modifica) o svuota (creazione) all'apertura.
  useEffect(() => {
    if (!isOpen) return;
    reset({
      nome: aula?.nome ?? '',
      descrizione: aula?.descrizione ?? '',
      annoScolastico: aula?.annoScolastico ?? '',
      livelloJLPT: aula?.livelloJLPT ?? '',
      colore: aula?.colore ?? '',
    });
  }, [isOpen, aula, reset]);

  const onSubmit = async (values) => {
    // undefined (campo svuotato) → null per consentire l'azzeramento in modifica.
    const payload = {
      nome: values.nome,
      descrizione: values.descrizione ?? null,
      annoScolastico: values.annoScolastico ?? null,
      livelloJLPT: values.livelloJLPT ?? null,
      colore: values.colore ?? null,
    };

    try {
      if (isEdit) {
        await updateAula.mutateAsync({ id: aula.id, ...payload });
        toast.success(t('aule.toast.updated'));
      } else {
        await createAula.mutateAsync(payload);
        toast.success(t('aule.toast.created'));
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

  const isPending = createAula.isPending || updateAula.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('aule.form.editTitle') : t('aule.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="aula-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('aule.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form id="aula-form" onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <TextField
          label={t('aule.form.nome')}
          required
          error={errors.nome?.message}
          {...register('nome')}
        />
        <TextArea
          label={t('aule.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />
        <div className={styles.formRow}>
          <TextField
            label={t('aule.form.annoScolastico')}
            placeholder="2025/2026"
            error={errors.annoScolastico?.message}
            {...register('annoScolastico')}
          />
          <Select
            label={t('aule.form.livelloJLPT')}
            placeholder={t('aule.form.livelloNessuno')}
            error={errors.livelloJLPT?.message}
            {...register('livelloJLPT')}
          >
            {LIVELLI_JLPT.map((liv) => (
              <option key={liv} value={liv}>
                {liv}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label={t('aule.form.colore')}
          placeholder="#4F46E5"
          hint={t('aule.form.coloreHint')}
          error={errors.colore?.message}
          {...register('colore')}
        />
      </form>
    </Modal>
  );
};

export default AulaFormModal;
