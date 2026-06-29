import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildTeacherInviteSchema } from '../../../validators/authSchemas';
import { useCreateTeacherInvite } from '../../../hooks/useInvites';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import styles from './Invites.module.css';
import { useState, useEffect } from 'react';
import { getSchools } from '../../../services/adminService';
import Select from '../../../components/ui/Select';
/**
 * Form di creazione invito INSEGNANTE (solo admin — onboarding diretto).
 * Nessuna classe: l'admin inserisce solo l'email.
 */
const TeacherInviteForm = () => {
  const { t } = useTranslation();
  const createInvite = useCreateTeacherInvite();

  const schema = useMemo(() => buildTeacherInviteSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await createInvite.mutateAsync(values);
      toast.success(t('invites.create.teacherSuccess', { email: values.email }));
      reset({ email: '' });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors?.email) {
        setError('email', { type: 'server', message: parsed.fieldErrors.email });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <h2 className={styles.panelTitle}>{t('invites.create.teacherTitle')}</h2>
      <p className={styles.panelText}>{t('invites.create.teacherText')}</p>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm} noValidate>
        <TextField
          label={t('auth.fields.email')}
          type="email"
          autoComplete="off"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div className={styles.formActions}>
          <Button type="submit" isLoading={createInvite.isPending}>
            {t('invites.create.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default TeacherInviteForm;
