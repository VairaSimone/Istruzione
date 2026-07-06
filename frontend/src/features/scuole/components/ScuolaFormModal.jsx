import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildScuolaSchema, parseImpostazioni } from '../../../validators/scuoleSchemas';
import { useCreateScuola, useUpdateScuola } from '../../../hooks/useScuole';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Button from '../../../components/ui/Button';
import styles from './Scuole.module.css';

const CAMPI = ['nome', 'impostazioniText'];

/**
 * Modal per creare (scuola = null) o modificare una scuola.
 * In modifica il campo impostazioni è precompilato col JSON corrente e viene
 * inviato per intero (sostituzione tramite PATCH /:id).
 */
const ScuolaFormModal = ({ isOpen, onClose, scuola = null }) => {
  const { t } = useTranslation();
  const createScuola = useCreateScuola();
  const updateScuola = useUpdateScuola();
  const isEdit = Boolean(scuola);

  const schema = useMemo(() => buildScuolaSchema(t), [t]);
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
      nome: scuola?.nome ?? '',
      impostazioniText:
        scuola?.impostazioni && Object.keys(scuola.impostazioni).length > 0
          ? JSON.stringify(scuola.impostazioni, null, 2)
          : '',
    });
  }, [isOpen, scuola, reset]);

  const onSubmit = async (values) => {
    let impostazioni;
    try {
      impostazioni = parseImpostazioni(values.impostazioniText);
    } catch {
      setError('impostazioniText', { type: 'validate', message: t('scuole.validation.impostazioniJson') });
      return;
    }

    try {
      if (isEdit) {
        await updateScuola.mutateAsync({
          id: scuola.id,
          nome: values.nome,
          // In modifica inviamo sempre le impostazioni (vuoto ⇒ {} esplicito).
          impostazioni: impostazioni ?? {},
        });
        toast.success(t('scuole.toast.updated'));
      } else {
        await createScuola.mutateAsync({
          nome: values.nome,
          ...(impostazioni !== undefined ? { impostazioni } : {}),
        });
        toast.success(t('scuole.toast.created'));
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (CAMPI.includes(field)) setError(field, { type: 'server', message });
          if (field === 'impostazioni') setError('impostazioniText', { type: 'server', message });
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = createScuola.isPending || updateScuola.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('scuole.form.editTitle') : t('scuole.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="scuola-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('scuole.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form id="scuola-form" onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm} noValidate>
        <TextField
          label={t('scuole.form.nome')}
          required
          error={errors.nome?.message}
          {...register('nome')}
        />
        <div className={styles.jsonArea}>
          <TextArea
            label={t('scuole.form.impostazioni')}
            rows={8}
            placeholder={'{\n  "esempio": true\n}'}
            hint={t('scuole.form.impostazioniHint')}
            error={errors.impostazioniText?.message}
            {...register('impostazioniText')}
          />
        </div>
      </form>
    </Modal>
  );
};

export default ScuolaFormModal;
