import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildLoginSchema } from '../validators/authSchemas';
import { useLogin } from '../hooks/useLogin';
import { useResendVerification } from '../hooks/useResendVerification';
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
  const [searchParams] = useSearchParams();
  const loginMutation = useLogin();
  const resendMutation = useResendVerification();
  const [formError, setFormError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRaw, setLockoutRaw] = useState(null);
  // Mostra il blocco "re-invia verifica" quando il login fallisce per email
  // non verificata.
  const [showResend, setShowResend] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const schema = useMemo(() => buildLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;

  const onSubmit = async (values) => {
    setFormError(null);
    setIsLocked(false);
    setLockoutRaw(null);
    setShowResend(false);
    setResendDone(false);

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

      // Email non verificata: offri il re-invio del link di verifica.
      if (parsed.code === API_ERROR_CODES.EMAIL_NOT_VERIFIED) {
        setShowResend(true);
      }

      setFormError(message);
    }
  };

  const handleResend = async () => {
    const email = getValues('email');
    if (!email) {
      setFormError(t('validation.emailRequired'));
      return;
    }

    try {
      await resendMutation.mutateAsync({ email });
    } catch {
      // La risposta è generica anche in caso di errore lato server: non
      // riveliamo nulla all'utente, mostriamo comunque l'esito neutro.
    } finally {
      setResendDone(true);
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

        {showResend && (
          <div className={styles.resendBox}>
            {resendDone ? (
              <p className={styles.resendText}>{t('auth.resend.done')}</p>
            ) : (
              <>
                <p className={styles.resendText}>{t('auth.resend.prompt')}</p>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  isLoading={resendMutation.isPending}
                  onClick={handleResend}
                >
                  {t('auth.resend.cta')}
                </Button>
              </>
            )}
          </div>
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

        <p className={styles.switchAuth}>{t('auth.login.studentInviteNote')}</p>
      </Card>
    </div>
  );
};

export default LoginPage;
