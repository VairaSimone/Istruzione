import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildEventoSchema } from '../../../validators/calendarioSchemas';
import { useCreateEvento, useUpdateEvento } from '../../../hooks/useCalendario';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { toDatetimeLocal, fromDatetimeLocal } from '../../../utils/datetime';
import { CODICI_EVENTO } from '../../../constants/tipiEvento';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import DestinatariPicker from './DestinatariPicker';
import styles from './Calendario.module.css';

const CAMPI = [
  'titolo',
  'tipo',
  'dataInizio',
  'dataFine',
  'tuttoIlGiorno',
  'luogo',
  'linkVideochiamata',
];

/**
 * Crea o modifica un EVENTO di calendario.
 *
 * In CREAZIONE si possono indicare i destinatari inline (aule/studenti), inviati
 * con la POST. In MODIFICA i destinatari si gestiscono dal dettaglio, tramite
 * gli endpoint dedicati: qui restano i soli campi dell'evento.
 *
 * `dataIniziale` (facoltativa) pre-compila la data quando l'evento nasce da un
 * click su un giorno del calendario.
 */
const EventoFormModal = ({ isOpen, onClose, evento = null, dataIniziale = null }) => {
  const { t } = useTranslation();
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const isEdit = Boolean(evento);

  const [destinatari, setDestinatari] = useState([]);

  const schema = useMemo(() => buildEventoSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      titolo: evento?.titolo ?? '',
      tipo: evento?.tipo ?? 'lezione',
      dataInizio: toDatetimeLocal(evento?.dataInizio ?? dataIniziale) ?? '',
      dataFine: toDatetimeLocal(evento?.dataFine) ?? '',
      tuttoIlGiorno: evento?.tuttoIlGiorno ?? false,
      luogo: evento?.luogo ?? '',
      linkVideochiamata: evento?.linkVideochiamata ?? '',
      descrizione: evento?.descrizione ?? '',
    });
  }, [isOpen, evento, dataIniziale, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      tipo: values.tipo,
      dataInizio: fromDatetimeLocal(values.dataInizio),
      dataFine: values.dataFine ? fromDatetimeLocal(values.dataFine) : null,
      tuttoIlGiorno: values.tuttoIlGiorno ?? false,
      luogo: values.luogo ?? null,
      linkVideochiamata: values.linkVideochiamata ?? null,
      descrizione: values.descrizione ?? null,
    };

    try {
      if (isEdit) {
        await updateEvento.mutateAsync({ id: evento.id, ...payload });
        toast.success(t('calendario.toast.updated'));
      } else {
        const bersagli = destinatari.map((d) =>
          d.classeId ? { classeId: d.classeId } : { utenteId: d.utenteId }
        );
        await createEvento.mutateAsync({ ...payload, destinatari: bersagli });
        toast.success(t('calendario.toast.created'));
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (CAMPI.includes(field)) setError(field, { type: 'server', message });
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = createEvento.isPending || updateEvento.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('calendario.form.editTitle') : t('calendario.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="evento-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('calendario.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form id="evento-form" onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <TextField
          label={t('calendario.form.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />

        <div className={styles.formRow}>
          <Select
            label={t('calendario.form.tipo')}
            required
            error={errors.tipo?.message}
            {...register('tipo')}
          >
            {CODICI_EVENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t(`calendario.tipi.${tipo}`)}
              </option>
            ))}
          </Select>
          <TextField
            label={t('calendario.form.luogo')}
            hint={t('calendario.form.luogoHint')}
            error={errors.luogo?.message}
            {...register('luogo')}
          />
        </div>

        <div className={styles.formRow}>
          <TextField
            label={t('calendario.form.dataInizio')}
            type="datetime-local"
            required
            error={errors.dataInizio?.message}
            {...register('dataInizio')}
          />
          <TextField
            label={t('calendario.form.dataFine')}
            type="datetime-local"
            hint={t('calendario.form.dataFineHint')}
            error={errors.dataFine?.message}
            {...register('dataFine')}
          />
        </div>

        <div className={styles.checkboxRow}>
          <input id="tuttoIlGiorno" type="checkbox" {...register('tuttoIlGiorno')} />
          <label htmlFor="tuttoIlGiorno">{t('calendario.form.tuttoIlGiorno')}</label>
        </div>

        <TextField
          label={t('calendario.form.linkVideochiamata')}
          type="url"
          placeholder="https://…"
          hint={t('calendario.form.linkHint')}
          error={errors.linkVideochiamata?.message}
          {...register('linkVideochiamata')}
        />

        <TextArea
          label={t('calendario.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />

        {/* I destinatari inline solo in creazione; in modifica dal dettaglio. */}
        {!isEdit && <DestinatariPicker value={destinatari} onChange={setDestinatari} />}
      </form>
    </Modal>
  );
};

export default EventoFormModal;
