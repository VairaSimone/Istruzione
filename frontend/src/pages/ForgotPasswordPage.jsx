import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { buildForgotPasswordSchema } from '../validators/authSchemas';
import { useForgotPassword } from '../hooks/usePasswordAndEmailFlows';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const forgotPasswordMutation = useForgotPassword();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const schema = useMemo(() => buildForgotPasswordSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await forgotPasswordMutation.mutateAsync(values);
      setIsSuccess(true);
    } catch (error) {
      setFormError(getApiErrorMessage(t, error));
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon} aria-hidden="true">
              便
            </div>
            <h1 className={styles.title}>{t('auth.forgot.successTitle')}</h1>
            <p className={styles.successText}>{t('auth.forgot.successText')}</p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                {t('auth.forgot.backToLogin')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            鍵
          </span>
          <h1 className={styles.title}>{t('auth.forgot.title')}</h1>
          <p className={styles.subtitle}>{t('auth.forgot.subtitle')}</p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label={t('auth.fields.email')}
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={forgotPasswordMutation.isPending}
          >
            {t('auth.forgot.submit')}
          </Button>
        </form>

        <p className={styles.switchAuth}>
          <Link to={ROUTES.LOGIN}>{t('auth.forgot.backToLogin')}</Link>
        </p>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
