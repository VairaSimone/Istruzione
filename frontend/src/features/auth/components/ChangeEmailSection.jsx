import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changeEmailSchema } from '../../../validators/authSchemas';
import { useRequestEmailChange } from '../../../hooks/useProfileMutations';
import { parseApiError } from '../../../utils/parseApiError';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import FormError from '../../../components/shared/FormError';
import styles from './ProfileSections.module.css';

/**
 * Sezione per avviare il cambio email. Non modifica l'email visualizzata
 * immediatamente: il backend invia un link di conferma alla NUOVA
 * casella, e la conferma effettiva avviene fuori dal flusso React (vedi
 * VerifyEmailChangePage e la nota sul limite del redirect di errore).
 */
const ChangeEmailSection = () => {
  const requestEmailChangeMutation = useRequestEmailChange();
  const [formError, setFormError] = useState(null);
  const [requestSent, setRequestSent] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changeEmailSchema),
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await requestEmailChangeMutation.mutateAsync(values);
      setRequestSent(values.nuovaEmail);
      reset();
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>Cambia indirizzo email</h2>
      <p className={styles.sectionDescription}>
        Riceverai un'email di conferma al nuovo indirizzo. Il cambio sarà effettivo solo
        dopo aver cliccato il link di conferma.
      </p>

      {requestSent && (
        <p className={styles.successMessage}>
          Email di conferma inviata a <strong>{requestSent}</strong>. Controlla la tua
          nuova casella di posta.
        </p>
      )}

      <FormError message={formError} />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm} noValidate>
        <div className={styles.inlineFormField}>
          <TextField
            label="Nuovo indirizzo email"
            type="email"
            required
            error={errors.nuovaEmail?.message}
            {...register('nuovaEmail')}
          />
        </div>
        <div className={styles.inlineFormButton}>
          <Button type="submit" isLoading={requestEmailChangeMutation.isPending}>
            Invia conferma
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ChangeEmailSection;
