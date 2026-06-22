import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { buildResetPasswordSchema } from '../validators/authSchemas';
import { useResetPassword } from '../hooks/usePasswordAndEmailFlows';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';

/**
 * Pagina raggiunta dal link nell'email di reset password:
 * /reset-password?token=<hex64>
 */
const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const resetPasswordMutation = useResetPassword();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const schema = useMemo(() => buildResetPasswordSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ nuovaPassword }) => {
    setFormError(null);
    try {
      await resetPasswordMutation.mutateAsync({ token, nuovaPassword });
      setIsSuccess(true);
    } catch (error) {
      setFormError(getApiErrorMessage(t, error));
    }
  };

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <FormError message={t('auth.reset.missingToken')} />
          <Link to={ROUTES.FORGOT_PASSWORD}>
            <Button fullWidth variant="secondary">
              {t('auth.reset.requestNew')}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon} aria-hidden="true">
              済
            </div>
            <h1 className={styles.title}>{t('auth.reset.successTitle')}</h1>
            <p className={styles.successText}>{t('auth.reset.successText')}</p>
            <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              {t('auth.reset.successCta')}
            </Button>
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
          <h1 className={styles.title}>{t('auth.reset.title')}</h1>
          <p className={styles.subtitle}>{t('auth.reset.subtitle')}</p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label={t('auth.fields.newPassword')}
            type="password"
            autoComplete="new-password"
            required
            hint={t('auth.passwordHint')}
            error={errors.nuovaPassword?.message}
            {...register('nuovaPassword')}
          />
          <TextField
            label={t('auth.fields.confirmNewPassword')}
            type="password"
            autoComplete="new-password"
            required
            error={errors.confermaPassword?.message}
            {...register('confermaPassword')}
          />

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={resetPasswordMutation.isPending}
          >
            {t('auth.reset.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
