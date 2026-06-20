import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { loginSchema } from '../validators/authSchemas';
import { useLogin } from '../hooks/useLogin';
import { parseApiError } from '../utils/parseApiError';
import { ROUTES } from '../constants/routes';
import { API_ERROR_CODES } from '../constants/domain';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import LockoutNotice from '../features/auth/components/LockoutNotice';
import styles from './AuthPage.module.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [formError, setFormError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;

  const onSubmit = async (values) => {
    setFormError(null);
    setIsLocked(false);

    try {
      await loginMutation.mutateAsync(values);
      toast.success('Accesso effettuato.');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const parsed = parseApiError(error);

      // 403 = account bloccato per troppi tentativi falliti (vedi
      // authService.loginUtente, MAX_TENTATIVI_FALLITI = 5)
      if (parsed.statusCode === 403) {
        setIsLocked(true);
        setFormError(parsed.message);
        return;
      }

      // Caso speciale: email non verificata. Il backend lancia AppError
      // con messaggio letterale 'auth.email_not_verified' (chiave i18n
      // non risolta, bug minore del backend) — lo normalizziamo qui per
      // non mostrare la chiave grezza all'utente.
      if (parsed.message === 'auth.email_not_verified') {
        setFormError(
          'La tua email non è ancora stata verificata. Controlla la tua casella di posta per il link di conferma.'
        );
        return;
      }

      if (parsed.code === API_ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS) {
        setFormError(parsed.message);
        return;
      }

      setFormError(parsed.message);
    }
  };

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            入
          </span>
          <h1 className={styles.title}>Accedi</h1>
          <p className={styles.subtitle}>Bentornato. Inserisci le tue credenziali.</p>
        </div>

        {isLocked ? (
          <LockoutNotice message={formError} />
        ) : (
          <FormError message={formError} />
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          <div className={styles.forgotLink}>
            <Link to={ROUTES.FORGOT_PASSWORD}>Password dimenticata?</Link>
          </div>

          <Button type="submit" fullWidth size="lg" isLoading={loginMutation.isPending}>
            Accedi
          </Button>
        </form>

        <p className={styles.switchAuth}>
          Non hai un account? <Link to={ROUTES.REGISTER}>Registrati</Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
