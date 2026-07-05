import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildRispostaSchema } from '../../../validators/messaggiSchemas';
import { useRispondi } from '../../../hooks/useMessaggi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import TextArea from '../../../components/ui/TextArea';
import Button from '../../../components/ui/Button';
import styles from './Messaggi.module.css';

/** Form per rispondere a un messaggio ricevuto (se le risposte sono consentite). */
const RispostaForm = ({ messaggioId }) => {
  const { t } = useTranslation();
  const rispondi = useRispondi();

  const schema = useMemo(() => buildRispostaSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await rispondi.mutateAsync({ id: messaggioId, corpo: values.corpo });
      toast.success(t('messaggi.detail.replySuccess'));
      reset({ corpo: '' });
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
      <TextArea
        label={t('messaggi.detail.replyLabel')}
        rows={3}
        error={errors.corpo?.message}
        {...register('corpo')}
      />
      <div>
        <Button type="submit" isLoading={rispondi.isPending}>
          {t('messaggi.detail.reply')}
        </Button>
      </div>
    </form>
  );
};

export default RispostaForm;
