import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildValutaSchema } from '../../../validators/compitiSchemas';
import { useValutaConsegna } from '../../../hooks/useCompiti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

/** Valuta la consegna di uno studente (punteggio e/o feedback). */
const ValutaModal = ({ isOpen, onClose, compitoId, riga, punteggioMassimo }) => {
  const { t } = useTranslation();
  const valuta = useValutaConsegna();

  const schema = useMemo(() => buildValutaSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      punteggioOttenuto: riga?.consegna?.punteggioOttenuto ?? '',
      feedback: riga?.consegna?.feedback ?? '',
    });
  }, [isOpen, riga, reset]);

  const onSubmit = async (values) => {
    try {
      await valuta.mutateAsync({
        id: compitoId,
        utenteId: riga.studente.id,
        punteggioOttenuto: values.punteggioOttenuto,
        feedback: values.feedback ?? null,
      });
      toast.success(t('compiti.toast.graded'));
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const studente = riga?.studente;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('compiti.valuta.title', {
        nome: studente ? `${studente.nome} ${studente.cognome}` : '',
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={valuta.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="valuta-form" isLoading={valuta.isPending}>
            {t('compiti.valuta.submit')}
          </Button>
        </>
      }
    >
      <form id="valuta-form" onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <TextField
          label={t('compiti.valuta.punteggio', { max: punteggioMassimo })}
          type="number"
          min="0"
          max={punteggioMassimo}
          error={errors.punteggioOttenuto?.message}
          {...register('punteggioOttenuto')}
        />
        <TextArea
          label={t('compiti.valuta.feedback')}
          rows={4}
          error={errors.feedback?.message}
          {...register('feedback')}
        />
      </form>
    </Modal>
  );
};

export default ValutaModal;
