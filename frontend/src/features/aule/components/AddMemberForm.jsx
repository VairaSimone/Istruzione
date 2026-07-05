import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildAddByEmailSchema } from '../../../validators/auleSchemas';
import { useAddStudent, useAddTeacher, useInviteStudent } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import styles from './Aule.module.css';

/**
 * Azioni di popolamento dell'aula:
 *  - aggiungi uno studente/insegnante GIÀ registrato tramite email;
 *  - invita un nuovo studente via email (iscrizione automatica al completamento).
 */
const AddMemberForm = ({ aulaId }) => {
  const { t } = useTranslation();
  const addStudent = useAddStudent();
  const addTeacher = useAddTeacher();
  const inviteStudent = useInviteStudent();

  const schema = useMemo(() => buildAddByEmailSchema(t), [t]);

  const studentForm = useForm({ resolver: zodResolver(schema) });
  const teacherForm = useForm({ resolver: zodResolver(schema) });
  const inviteForm = useForm({ resolver: zodResolver(schema) });

  const run = async (mutation, values, form, successKey) => {
    try {
      await mutation.mutateAsync({ id: aulaId, email: values.email });
      toast.success(t(successKey, { email: values.email }));
      form.reset({ email: '' });
    } catch (err) {
      const message = getApiErrorMessage(t, err);
      form.setError('email', { type: 'server', message });
      toast.error(message);
    }
  };

  return (
    <Card>
      <h3 className={styles.panelTitle}>{t('aule.detail.addTitle')}</h3>

      <form
        className={styles.inlineForm}
        onSubmit={studentForm.handleSubmit((v) =>
          run(addStudent, v, studentForm, 'aule.toast.studentAdded')
        )}
        noValidate
      >
        <TextField
          label={t('aule.detail.addStudent')}
          type="email"
          placeholder={t('aule.detail.emailPlaceholder')}
          error={studentForm.formState.errors.email?.message}
          {...studentForm.register('email')}
        />
        <Button type="submit" variant="secondary" isLoading={addStudent.isPending}>
          {t('common.add')}
        </Button>
      </form>

      <form
        className={styles.inlineForm}
        onSubmit={inviteForm.handleSubmit((v) =>
          run(inviteStudent, v, inviteForm, 'aule.toast.studentInvited')
        )}
        noValidate
      >
        <TextField
          label={t('aule.detail.inviteStudent')}
          type="email"
          placeholder={t('aule.detail.emailPlaceholder')}
          error={inviteForm.formState.errors.email?.message}
          {...inviteForm.register('email')}
        />
        <Button type="submit" isLoading={inviteStudent.isPending}>
          {t('aule.detail.invite')}
        </Button>
      </form>

      <form
        className={styles.inlineForm}
        onSubmit={teacherForm.handleSubmit((v) =>
          run(addTeacher, v, teacherForm, 'aule.toast.teacherAdded')
        )}
        noValidate
      >
        <TextField
          label={t('aule.detail.addTeacher')}
          type="email"
          placeholder={t('aule.detail.emailPlaceholder')}
          error={teacherForm.formState.errors.email?.message}
          {...teacherForm.register('email')}
        />
        <Button type="submit" variant="secondary" isLoading={addTeacher.isPending}>
          {t('common.add')}
        </Button>
      </form>
    </Card>
  );
};

export default AddMemberForm;
