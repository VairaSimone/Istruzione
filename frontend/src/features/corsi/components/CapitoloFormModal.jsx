import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCapitoloSchema, PADRE_NESSUNO } from '../../../validators/corsiSchemas';
import { useAddCapitolo, useUpdateCapitolo } from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Corsi.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'videoUrl',
  'videoDurataSecondi',
  'scaricabile',
  'ordine',
  'capitoloPadreId',
];

// Override tri-stato → valore inviato al backend:
//   'eredita' → null (eredita dal corso); 'si' → true; 'no' → false.
const overrideToBackend = (v) => (v === 'si' ? true : v === 'no' ? false : null);
const overrideFromBackend = (v) => (v === true ? 'si' : v === false ? 'no' : 'eredita');

/**
 * Crea o modifica un capitolo del corso indicato (`corsoId`).
 *
 * SOTTO-CAPITOLI (stile Udemy): un capitolo con `capitoloPadreId` valorizzato è
 * una lezione dentro una sezione. La profondità massima è 1, quindi:
 *   - in CREAZIONE, `capitoloPadreId` arriva come prop (bottone "aggiungi
 *     sotto-capitolo" della sezione) e non è modificabile dal form;
 *   - in MODIFICA si può ri-parentare tramite la select, ma solo se il capitolo
 *     non ha già dei sotto-capitoli (il backend risponde CAPITOLO_HAS_CHILDREN).
 *
 * @param {Array} sezioni  capitoli di primo livello del corso (per la select)
 * @param {string} capitoloPadreId  sezione padre pre-impostata in creazione
 */
const CapitoloFormModal = ({
  isOpen,
  onClose,
  corsoId,
  capitolo = null,
  capitoloPadreId = null,
  sezioni = [],
}) => {
  const { t } = useTranslation();
  const addCapitolo = useAddCapitolo();
  const updateCapitolo = useUpdateCapitolo();
  const isEdit = Boolean(capitolo);

  // In creazione il padre è deciso dal bottone premuto; in modifica dal dato.
  const padreCorrente = isEdit
    ? (capitolo?.capitoloPadreId ?? '')
    : (capitoloPadreId ?? '');
  const isSottoCapitolo = Boolean(padreCorrente);

  // Un capitolo che ha già dei figli non può diventare sotto-capitolo.
  const haFigli = Boolean(capitolo?.sottoCapitoli?.length);

  // Sezioni selezionabili come padre: primo livello, escluso se stesso.
  const sezioniDisponibili = useMemo(
    () => sezioni.filter((s) => s.id !== capitolo?.id),
    [sezioni, capitolo?.id]
  );

  const schema = useMemo(() => buildCapitoloSchema(t), [t]);
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
      titolo: capitolo?.titolo ?? '',
      descrizione: capitolo?.descrizione ?? '',
      videoUrl: capitolo?.videoUrl ?? '',
      videoDurataSecondi: capitolo?.videoDurataSecondi ?? '',
      scaricabile: overrideFromBackend(capitolo?.scaricabile),
      ordine: capitolo?.ordine ?? '',
      capitoloPadreId: padreCorrente || PADRE_NESSUNO,
    });
  }, [isOpen, capitolo, padreCorrente, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      videoUrl: values.videoUrl ?? null,
      videoDurataSecondi: values.videoDurataSecondi ?? null,
      scaricabile: overrideToBackend(values.scaricabile),
    };
    if (values.ordine !== undefined) payload.ordine = values.ordine;

    try {
      if (isEdit) {
        // La ri-parentela è possibile solo se il capitolo non ha figli.
        if (!haFigli) {
          const scelto = values.capitoloPadreId;
          payload.capitoloPadreId = !scelto || scelto === PADRE_NESSUNO ? null : scelto;
        }
        await updateCapitolo.mutateAsync({
          id: corsoId,
          capitoloId: capitolo.id,
          ...payload,
        });
        toast.success(t('corsi.toast.capitoloUpdated'));
      } else {
        if (padreCorrente) payload.capitoloPadreId = padreCorrente;
        await addCapitolo.mutateAsync({ id: corsoId, ...payload });
        toast.success(
          padreCorrente
            ? t('corsi.toast.sottoCapitoloAdded')
            : t('corsi.toast.capitoloAdded')
        );
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

  const isPending = addCapitolo.isPending || updateCapitolo.isPending;

  const titolo = isEdit
    ? isSottoCapitolo
      ? t('corsi.capitoloForm.editSottoTitle')
      : t('corsi.capitoloForm.editTitle')
    : isSottoCapitolo
      ? t('corsi.capitoloForm.createSottoTitle')
      : t('corsi.capitoloForm.createTitle');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={titolo}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="capitolo-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('corsi.capitoloForm.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="capitolo-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <TextField
          label={t('corsi.capitoloForm.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <TextArea
          label={t('corsi.capitoloForm.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />

        {/* Ri-parentela: solo in modifica e solo se il capitolo non ha figli. */}
        {isEdit && !haFigli && (
          <Select
            label={t('corsi.capitoloForm.capitoloPadre')}
            placeholder={t('corsi.capitoloForm.capitoloPadre')}
            error={errors.capitoloPadreId?.message}
            {...register('capitoloPadreId')}
          >
            <option value={PADRE_NESSUNO}>{t('corsi.capitoloForm.nessunPadre')}</option>
            {sezioniDisponibili.map((sezione) => (
              <option key={sezione.id} value={sezione.id}>
                {sezione.titolo}
              </option>
            ))}
          </Select>
        )}
        {isEdit && haFigli && (
          <p className={styles.mutedSmall}>{t('corsi.capitoloForm.haSottoCapitoli')}</p>
        )}

        <TextField
          label={t('corsi.capitoloForm.videoUrl')}
          hint={t('corsi.capitoloForm.videoUrlHint')}
          error={errors.videoUrl?.message}
          {...register('videoUrl')}
        />
        <div className={styles.formRow}>
          <TextField
            label={t('corsi.capitoloForm.videoDurata')}
            type="number"
            min="0"
            max="86400"
            hint={t('corsi.capitoloForm.videoDurataHint')}
            error={errors.videoDurataSecondi?.message}
            {...register('videoDurataSecondi')}
          />
          <TextField
            label={t('corsi.capitoloForm.ordine')}
            type="number"
            min="0"
            hint={t('corsi.capitoloForm.ordineHint')}
            error={errors.ordine?.message}
            {...register('ordine')}
          />
        </div>
        <Select
          label={t('corsi.capitoloForm.scaricabile')}
          placeholder={t('corsi.capitoloForm.scaricabile')}
          error={errors.scaricabile?.message}
          {...register('scaricabile')}
        >
          <option value="eredita">{t('corsi.capitoloForm.scaricabileEredita')}</option>
          <option value="si">{t('corsi.capitoloForm.scaricabileSi')}</option>
          <option value="no">{t('corsi.capitoloForm.scaricabileNo')}</option>
        </Select>
      </form>
    </Modal>
  );
};

export default CapitoloFormModal;
