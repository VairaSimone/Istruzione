import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../validators/authSchemas';
import { useRegister } from '../hooks/useRegister';
import { parseApiError } from '../utils/parseApiError';
import { ROUTES } from '../constants/routes';
import { CLASSI } from '../constants/domain';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async ({ confermaPassword: _confermaPassword, ...payload }) => {
    setFormError(null);

    try {
      await registerMutation.mutateAsync(payload);
      setIsSuccess(true);
    } catch (error) {
      const parsed = parseApiError(error);

      // Mappa eventuali errori per-campo restituiti dal validatore server
      // (422) sui campi corrispondenti del form, oltre al banner generico.
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (field in payload) {
            setError(field, { type: 'server', message });
          }
        });
      }

      setFormError(parsed.message);
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon} aria-hidden="true">
              済
            </div>
            <h1 className={styles.title}>Registrazione completata</h1>
            <p className={styles.successText}>
              Ti abbiamo inviato un'email di verifica. Apri il link contenuto nel
              messaggio per attivare il tuo account, poi potrai effettuare il login.
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
      <Card className={styles.cardWide}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            登
          </span>
          <h1 className={styles.title}>Crea il tuo account</h1>
          <p className={styles.subtitle}>
            Registrati per iniziare il tuo percorso di apprendimento.
          </p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className={styles.formRow}>
            <TextField
              label="Nome"
              autoComplete="given-name"
              required
              error={errors.nome?.message}
              {...register('nome')}
            />
            <TextField
              label="Cognome"
              autoComplete="family-name"
              required
              error={errors.cognome?.message}
              {...register('cognome')}
            />
          </div>

          <div className={styles.formRow}>
            <TextField
              label="Età"
              type="number"
              min={14}
              max={99}
              required
              error={errors.eta?.message}
              {...register('eta')}
            />
            <Select
              label="Classe"
              required
              error={errors.classe?.message}
              {...register('classe')}
            >
              {CLASSI.map((classe) => (
                <option key={classe} value={classe}>
                  {classe}
                </option>
              ))}
            </Select>
          </div>

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
            autoComplete="new-password"
            required
            hint="Min. 8 caratteri, una maiuscola, una minuscola, un numero, un carattere speciale"
            error={errors.password?.message}
            {...register('password')}
          />

          <TextField
            label="Conferma password"
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
            isLoading={registerMutation.isPending}
          >
            Registrati
          </Button>
        </form>

        <p className={styles.switchAuth}>
          Hai già un account? <Link to={ROUTES.LOGIN}>Accedi</Link>
        </p>
      </Card>
    </div>
  );
};

export default RegisterPage;
