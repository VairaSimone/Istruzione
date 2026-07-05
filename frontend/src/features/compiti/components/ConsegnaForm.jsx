import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildConsegnaSchema } from '../../../validators/compitiSchemas';
import { useConsegnaCompito } from '../../../hooks/useCompiti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

/**
 * Form di consegna: lo studente segna il compito come completato, indicando
 * facoltativamente il punteggio ottenuto e il tempo impiegato. Se già
 * consegnato, consente la ri-consegna (aggiornamento).
 */
const ConsegnaForm = ({ compito }) => {
  const { t } = useTranslation();
  const consegna = useConsegnaCompito();
  const giaConsegnato = Boolean(compito.consegna);

  const schema = useMemo(() => buildConsegnaSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      punteggioOttenuto: compito.consegna?.punteggioOttenuto ?? '',
      tempoImpiegatoSecondi: compito.consegna?.tempoImpiegatoSecondi ?? '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await consegna.mutateAsync({
        id: compito.id,
        punteggioOttenuto: values.punteggioOttenuto,
        tempoImpiegatoSecondi: values.tempoImpiegatoSecondi,
      });
      toast.success(t('compiti.studente.submitSuccess'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <h3 className={styles.panelTitle}>
        {giaConsegnato ? t('compiti.studente.resubmitTitle') : t('compiti.studente.submitTitle')}
      </h3>
      <p className={styles.mutedSmall}>{t('compiti.studente.submitHint')}</p>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <div className={styles.formRow}>
          <TextField
            label={t('compiti.studente.punteggio', { max: compito.punteggioMassimo })}
            type="number"
            min="0"
            max={compito.punteggioMassimo}
            error={errors.punteggioOttenuto?.message}
            {...register('punteggioOttenuto')}
          />
          <TextField
            label={t('compiti.studente.tempo')}
            type="number"
            min="0"
            error={errors.tempoImpiegatoSecondi?.message}
            {...register('tempoImpiegatoSecondi')}
          />
        </div>
        <div>
          <Button type="submit" isLoading={consegna.isPending}>
            {giaConsegnato ? t('compiti.studente.resubmit') : t('compiti.studente.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ConsegnaForm;
