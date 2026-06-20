import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '../validators/authSchemas';
import { useForgotPassword } from '../hooks/usePasswordAndEmailFlows';
import { parseApiError } from '../utils/parseApiError';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';

const ForgotPasswordPage = () => {
  const forgotPasswordMutation = useForgotPassword();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await forgotPasswordMutation.mutateAsync(values);
      // Il backend risponde sempre 200 indipendentemente dall'esistenza
      // dell'email (anti user-enumeration), quindi mostriamo sempre lo
      // stesso messaggio di successo generico.
      setIsSuccess(true);
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
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
            <h1 className={styles.title}>Controlla la tua email</h1>
            <p className={styles.successText}>
              Se l'indirizzo inserito è registrato, riceverai a breve le istruzioni per
              reimpostare la password.
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button fullWidth variant="secondary">
                Torna al login
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
          <h1 className={styles.title}>Password dimenticata</h1>
          <p className={styles.subtitle}>
            Inserisci la tua email: ti invieremo un link per reimpostarla.
          </p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label="Email"
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
            Invia istruzioni
          </Button>
        </form>

        <p className={styles.switchAuth}>
          <Link to={ROUTES.LOGIN}>Torna al login</Link>
        </p>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
