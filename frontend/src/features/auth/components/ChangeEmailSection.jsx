import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useTranslation } from 'react-i18next';
import { buildChangeEmailSchema } from '../../../validators/authSchemas';
import { useRequestEmailChange } from '../../../hooks/useProfileMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import FormError from '../../../components/shared/FormError';
import styles from './ProfileSections.module.css';

/**
 * Sezione per avviare il cambio email. Non modifica l'email visualizzata
 * immediatamente: il backend invia un link di conferma alla NUOVA
 * casella, e la conferma effettiva avviene su VerifyEmailChangePage.
 */
const ChangeEmailSection = () => {
  const { t } = useTranslation();
  const requestEmailChangeMutation = useRequestEmailChange();
  const [formError, setFormError] = useState(null);
  const [requestSent, setRequestSent] = useState(null);

  const schema = useMemo(() => buildChangeEmailSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await requestEmailChangeMutation.mutateAsync(values);
      setRequestSent(values.nuovaEmail);
      reset();
    } catch (error) {
      setFormError(getApiErrorMessage(t, error));
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>{t('profile.changeEmailTitle')}</h2>
      <p className={styles.sectionDescription}>
        {t('profile.changeEmailDescription')}
      </p>

      {requestSent && (
        <p className={styles.successMessage}>
          <Trans
            i18nKey="profile.changeEmailSuccess"
            values={{ email: requestSent }}
            components={[<strong key="email" />]}
          />
        </p>
      )}

      <FormError message={formError} />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm} noValidate>
        <div className={styles.inlineFormField}>
          <TextField
            label={t('auth.fields.newEmail')}
            type="email"
            required
            error={errors.nuovaEmail?.message}
            {...register('nuovaEmail')}
          />
        </div>
        <div className={styles.inlineFormButton}>
          <Button type="submit" isLoading={requestEmailChangeMutation.isPending}>
            {t('profile.changeEmailSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ChangeEmailSection;
