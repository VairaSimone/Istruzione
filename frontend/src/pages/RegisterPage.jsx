import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { buildRegisterSchema } from '../validators/authSchemas';
import { useRegister } from '../hooks/useRegister';
import { parseApiError } from '../utils/parseApiError';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import { CLASSI } from '../constants/domain';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const schema = useMemo(() => buildRegisterSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ confermaPassword: _confermaPassword, ...payload }) => {
    setFormError(null);

    try {
      await registerMutation.mutateAsync(payload);
      setIsSuccess(true);
    } catch (error) {
      const parsed = parseApiError(error);

      // Mappa eventuali errori per-campo restituiti dal validatore server (422)
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (field in payload) {
            setError(field, { type: 'server', message });
          }
        });
      }

      setFormError(getApiErrorMessage(t, error));
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
            <h1 className={styles.title}>{t('auth.register.successTitle')}</h1>
            <p className={styles.successText}>{t('auth.register.successText')}</p>
            <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              {t('auth.register.successCta')}
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
          <h1 className={styles.title}>{t('auth.register.title')}</h1>
          <p className={styles.subtitle}>{t('auth.register.subtitle')}</p>
        </div>

        <FormError message={formError} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className={styles.formRow}>
            <TextField
              label={t('auth.fields.nome')}
              autoComplete="given-name"
              required
              error={errors.nome?.message}
              {...register('nome')}
            />
            <TextField
              label={t('auth.fields.cognome')}
              autoComplete="family-name"
              required
              error={errors.cognome?.message}
              {...register('cognome')}
            />
          </div>

          <div className={styles.formRow}>
            <TextField
              label={t('auth.fields.eta')}
              type="number"
              min={14}
              max={99}
              required
              error={errors.eta?.message}
              {...register('eta')}
            />
            <Select
              label={t('auth.fields.classe')}
              required
              error={errors.classe?.message}
              {...register('classe')}
            >
              {CLASSI.map((classe) => (
                <option key={classe} value={classe}>
                  {t(`classi.${classe}`)}
                </option>
              ))}
            </Select>
          </div>

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
            autoComplete="new-password"
            required
            hint={t('auth.passwordHint')}
            error={errors.password?.message}
            {...register('password')}
          />

          <TextField
            label={t('auth.fields.confirmPassword')}
            type="password"
            autoComplete="new-password"
            required
            error={errors.confermaPassword?.message}
            {...register('confermaPassword')}
          />

          <Button type="submit" fullWidth size="lg" isLoading={registerMutation.isPending}>
            {t('auth.register.submit')}
          </Button>
        </form>

        <p className={styles.switchAuth}>
          {t('auth.register.haveAccount')} <Link to={ROUTES.LOGIN}>{t('nav.login')}</Link>
        </p>
      </Card>
    </div>
  );
};

export default RegisterPage;
