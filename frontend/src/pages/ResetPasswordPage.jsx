import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '../validators/authSchemas';
import { useResetPassword } from '../hooks/usePasswordAndEmailFlows';
import { parseApiError } from '../utils/parseApiError';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const resetPasswordMutation = useResetPassword();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async ({ nuovaPassword }) => {
    setFormError(null);
    try {
      await resetPasswordMutation.mutateAsync({ token, nuovaPassword });
      setIsSuccess(true);
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
    }
  };

  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <FormError message="Link non valido: il token di ripristino è mancante. Richiedi un nuovo link dalla pagina 'Password dimenticata'." />
          <Link to={ROUTES.FORGOT_PASSWORD}>
            <Button fullWidth variant="secondary">
              Richiedi nuovo link
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
            <h1 className={styles.title}>Password aggiornata</h1>
            <p className={styles.successText}>
              La tua password è stata reimpostata con successo. Effettua nuovamente il
              login con le nuove credenziali.
            </p>
            <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              Vai al login
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
          <h1 className={styles.title}>Reimposta password</h1>
          <p className={styles.subtitle}>Scegli una nuova password sicura.</p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label="Nuova password"
            type="password"
            autoComplete="new-password"
            required
            hint="Min. 8 caratteri, una maiuscola, una minuscola, un numero, un carattere speciale"
            error={errors.nuovaPassword?.message}
            {...register('nuovaPassword')}
          />
          <TextField
            label="Conferma nuova password"
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
            Aggiorna password
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
