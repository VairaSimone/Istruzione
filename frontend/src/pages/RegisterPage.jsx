import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation, Trans } from 'react-i18next';
import {
  buildRegisterStudentSchema,
  buildRegisterTeacherSchema,
} from '../validators/authSchemas';
import { useInviteToken } from '../hooks/useInviteToken';
import {
  useRegisterStudent,
  useRegisterTeacher,
} from '../hooks/useInviteRegistration';
import { parseApiError } from '../utils/parseApiError';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { ROUTES } from '../constants/routes';
import { INVITE_ROLES } from '../constants/domain';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Checkbox from '../components/ui/Checkbox';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FormError from '../components/shared/FormError';
import styles from './AuthPage.module.css';
import { etichettaClasse } from '../utils/classe';

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { data: invito, isLoading, isError, error: inviteError } = useInviteToken(token);
  const isTeacherInvite = invito?.ruolo === INVITE_ROLES.INSEGNANTE;

  // Lo schema dipende dal tipo di invito (studente richiede anche l'età).
  const schema = useMemo(
    () => (isTeacherInvite ? buildRegisterTeacherSchema(t) : buildRegisterStudentSchema(t)),
    [t, isTeacherInvite]
  );

  const registerStudent = useRegisterStudent();
  const registerTeacher = useRegisterTeacher();
  const [formError, setFormError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confermaPassword: _confermaPassword, ...values }) => {
    setFormError(null);
    try {
      if (isTeacherInvite) {
        await registerTeacher.mutateAsync({ token, ...values });
      } else {
        await registerStudent.mutateAsync({ token, ...values });
      }
      setIsSuccess(true);
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (field in values) setError(field, { type: 'server', message });
        });
      }
      setFormError(getApiErrorMessage(t, err));
    }
  };

  // ── Token assente: nessuna registrazione pubblica ──────────────────
  if (!token) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.header}>
            <span className={styles.mark} aria-hidden="true">
              鍵
            </span>
            <h1 className={styles.title}>{t('auth.invite.noTokenTitle')}</h1>
            <p className={styles.subtitle}>{t('auth.invite.noTokenText')}</p>
          </div>
          <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
            {t('auth.invite.goToLogin')}
          </Button>
        </Card>
      </div>
    );
  }

  // ── Validazione token in corso ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <Spinner size="lg" label={t('auth.invite.checking')} />
        </Card>
      </div>
    );
  }

  // ── Token non valido / scaduto / già usato ─────────────────────────
  if (isError) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.header}>
            <span className={styles.mark} aria-hidden="true">
              ✕
            </span>
            <h1 className={styles.title}>{t('auth.invite.invalidTitle')}</h1>
            <p className={styles.subtitle}>{getApiErrorMessage(t, inviteError)}</p>
          </div>
          <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
            {t('auth.invite.goToLogin')}
          </Button>
        </Card>
      </div>
    );
  }

  // ── Successo ───────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon} aria-hidden="true">
              済
            </div>
            <h1 className={styles.title}>{t('auth.invite.successTitle')}</h1>
            <p className={styles.successText}>{t('auth.invite.successText')}</p>
            <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              {t('auth.invite.successCta')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Form di completamento ──────────────────────────────────────────
  const isPending = registerStudent.isPending || registerTeacher.isPending;

  return (
    <div className={styles.wrapper}>
      <Card className={styles.cardWide}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            登
          </span>
          <h1 className={styles.title}>
            {isTeacherInvite
              ? t('auth.invite.teacherTitle')
              : t('auth.invite.studentTitle')}
          </h1>
          <p className={styles.subtitle}>
            {isTeacherInvite
              ? t('auth.invite.teacherSubtitle')
              : t('auth.invite.studentSubtitle')}
          </p>
        </div>

        <FormError message={formError} />

        {/* Dati ereditati dall'invito (sola lettura) */}
        <TextField
          label={t('auth.fields.email')}
          value={invito.email}
          readOnly
          disabled
        />
        {!isTeacherInvite && (
          <TextField
            label={t('auth.fields.classe')}
            value={etichettaClasse(t, invito.classe)}
            readOnly
            disabled
          />
        )}

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

          {!isTeacherInvite && (
            <TextField
              label={t('auth.fields.eta')}
              type="number"
              min={14}
              max={99}
              required
              error={errors.eta?.message}
              {...register('eta')}
            />
          )}

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

          <Checkbox
            required
            error={errors.accettaTermini?.message}
            label={
              <Trans
                i18nKey="auth.terms.label"
                components={{
                  termini: (
                    <Link to={ROUTES.TERMINI} target="_blank" rel="noopener noreferrer" />
                  ),
                  privacy: (
                    <Link to={ROUTES.PRIVACY} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              />
            }
            {...register('accettaTermini')}
          />

          <Button type="submit" fullWidth size="lg" isLoading={isPending}>
            {t('auth.invite.submit')}
          </Button>
        </form>

        <p className={styles.switchAuth}>
          {t('auth.invite.haveAccount')} <Link to={ROUTES.LOGIN}>{t('nav.login')}</Link>
        </p>
      </Card>
    </div>
  );
};

export default RegisterPage;
