import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildLoginSchema } from '../validators/authSchemas';
import { useLogin } from '../hooks/useLogin';
import { parseApiError } from '../utils/parseApiError';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import { API_ERROR_CODES } from '../constants/domain';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import LockoutNotice from '../features/auth/components/LockoutNotice';
import styles from './AuthPage.module.css';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [formError, setFormError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRaw, setLockoutRaw] = useState(null);

  const schema = useMemo(() => buildLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;

  const onSubmit = async (values) => {
    setFormError(null);
    setIsLocked(false);
    setLockoutRaw(null);

    try {
      await loginMutation.mutateAsync(values);
      toast.success(t('auth.login.success'));
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const parsed = parseApiError(error);
      const message = getApiErrorMessage(t, error);

      // 403 = account bloccato per troppi tentativi falliti
      if (
        parsed.statusCode === 403 ||
        parsed.code === API_ERROR_CODES.ACCOUNT_LOCKED
      ) {
        setIsLocked(true);
        // messaggio grezzo del backend: serve solo per estrarne i minuti
        setLockoutRaw(parsed.message);
        setFormError(message);
        return;
      }

      setFormError(message);
    }
  };

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            入
          </span>
          <h1 className={styles.title}>{t('auth.login.title')}</h1>
          <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>
        </div>

        {isLocked ? (
          <LockoutNotice message={lockoutRaw} />
        ) : (
          <FormError message={formError} />
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label={t('auth.fields.email')}
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label={t('auth.fields.password')}
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          <div className={styles.forgotLink}>
            <Link to={ROUTES.FORGOT_PASSWORD}>{t('auth.login.forgot')}</Link>
          </div>

          <Button type="submit" fullWidth size="lg" isLoading={loginMutation.isPending}>
            {t('auth.login.submit')}
          </Button>
        </form>

        <p className={styles.switchAuth}>
          {t('auth.login.noAccount')} <Link to={ROUTES.REGISTER}>{t('nav.register')}</Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
