import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildStudentInviteSchema } from '../../../validators/authSchemas';
import { useCreateStudentInvite } from '../../../hooks/useInvites';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { CLASSE_MAX } from '../../../constants/domain';
import { useAuthStore, selectIsAdmin } from '../../../store/authStore';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import VocabolarioField from '../../../components/ui/VocabolarioField';
import Button from '../../../components/ui/Button';
import ScuolaSelect from '../../scuole/components/ScuolaSelect';
import styles from './Invites.module.css';

/**
 * Form di creazione invito STUDENTE (insegnante/admin).
 * L'insegnante inserisce email + classe (la scuola è la propria, gestita dal
 * backend). L'admin, essendo trasversale, sceglie anche la SCUOLA di
 * destinazione (campo obbligatorio, mostrato solo per admin).
 */
const StudentInviteForm = () => {
  const { t } = useTranslation();
  const createInvite = useCreateStudentInvite();
  const isAdmin = useAuthStore(selectIsAdmin);

  const schema = useMemo(
    () => buildStudentInviteSchema(t, { requireScuola: isAdmin }),
    [t, isAdmin]
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await createInvite.mutateAsync(values);
      toast.success(t('invites.create.studentSuccess', { email: values.email }));
      reset({ email: '', classe: '', scuolaId: '' });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (['email', 'classe', 'scuolaId'].includes(field)) {
            setError(field, { type: 'server', message });
          }
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <h2 className={styles.panelTitle}>{t('invites.create.studentTitle')}</h2>
      <p className={styles.panelText}>{t('invites.create.studentText')}</p>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm} noValidate>
        <TextField
          label={t('auth.fields.email')}
          type="email"
          autoComplete="off"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        {/*
          La classe non è più un ENUM di piattaforma: se la scuola ha definito
          `didattica.classiDisponibili` compare un <select> con quelle voci,
          altrimenti un campo a testo libero. Un'accademia serale non deve
          scegliere fra "Prima" e "Quinta".
        */}
        <VocabolarioField
          vocabolario="classiDisponibili"
          label={t('auth.fields.classe')}
          required
          consentiVuoto={false}
          maxLength={CLASSE_MAX}
          error={errors.classe?.message}
          {...register('classe')}
        />
        {isAdmin && (
          <ScuolaSelect required error={errors.scuolaId?.message} {...register('scuolaId')} />
        )}
        <div className={styles.formActions}>
          <Button type="submit" isLoading={createInvite.isPending}>
            {t('invites.create.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default StudentInviteForm;
