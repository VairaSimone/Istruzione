import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildCorsoSchema, VALUTE_SUPPORTATE } from '../../../validators/corsiSchemas';
import { useCreateCorso, useUpdateCorso } from '../../../hooks/useCorsi';
import { useAuleList } from '../../../hooks/useAule';
import { useFunzionalitaAttiva } from '../../../hooks/useConfig';
import { FUNZIONALITA } from '../../../constants/funzionalita';
import { useAuthStore, selectIsAdmin } from '../../../store/authStore';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import { STATI_CORSO, LIVELLO_MAX, MATERIA_MAX } from '../../../constants/domain';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import VocabolarioField from '../../../components/ui/VocabolarioField';
import Button from '../../../components/ui/Button';
import ScuolaSelect from '../../scuole/components/ScuolaSelect';
import styles from './Corsi.module.css';
import pagamentiStyles from '../../pagamenti/components/Pagamenti.module.css';

const CAMPI = [
  'titolo',
  'descrizione',
  'copertinaUrl',
  'materia',
  'livello',
  'stato',
  'scuolaId',
  'acquistabile',
  'prezzoEuro',
  'valuta',
  'descrizioneVendita',
  'aulaDestinazioneId',
];

/**
 * Crea o modifica un corso. In creazione, un admin deve indicare la scuola
 * (l'insegnante usa la propria, gestita dal backend). La scuola NON è
 * modificabile dopo la creazione (il backend non accetta il cambio tenant).
 *
 * MATERIA e LIVELLO sono `VocabolarioField`: diventano <select> se la scuola ha
 * definito i propri vocabolari, altrimenti restano a testo libero. Un corso può
 * riguardare qualsiasi disciplina — nessun elenco è cablato qui.
 */
const CorsoFormModal = ({ isOpen, onClose, corso = null }) => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(selectIsAdmin);
  const createCorso = useCreateCorso();
  const updateCorso = useUpdateCorso();
  const isEdit = Boolean(corso);
  const requireScuola = isAdmin && !isEdit;

  const schema = useMemo(
    () => buildCorsoSchema(t, { requireScuola }),
    [t, requireScuola]
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  // Sezione vendita: disponibile solo se la scuola ha attivo il modulo pagamenti.
  const pagamentiAttivo = useFunzionalitaAttiva(FUNZIONALITA.PAGAMENTI);
  const { data: auleData } = useAuleList();
  const aule = auleData?.aule ?? [];
  const acquistabile = useWatch({ control, name: 'acquistabile' });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      titolo: corso?.titolo ?? '',
      descrizione: corso?.descrizione ?? '',
      copertinaUrl: corso?.copertinaUrl ?? '',
      materia: corso?.materia ?? '',
      // `livelloJLPT`: alias storico ancora presente nelle risposte in cache.
      livello: corso?.livello ?? corso?.livelloJLPT ?? '',
      stato: corso?.stato ?? 'bozza',
      videoScaricabile: corso?.videoScaricabile ?? false,
      scuolaId: corso?.scuolaId ?? '',
      acquistabile: corso?.acquistabile ?? false,
      // Prezzo mostrato in euro (il backend lavora in centesimi).
      prezzoEuro:
        corso?.prezzoCentesimi != null
          ? (corso.prezzoCentesimi / 100).toFixed(2)
          : '',
      valuta: corso?.valuta ?? 'EUR',
      descrizioneVendita: corso?.descrizioneVendita ?? '',
      aulaDestinazioneId: corso?.aulaDestinazioneId ?? '',
    });
  }, [isOpen, corso, reset]);

  const onSubmit = async (values) => {
    const payload = {
      titolo: values.titolo,
      descrizione: values.descrizione ?? null,
      copertinaUrl: values.copertinaUrl ?? null,
      materia: values.materia ?? null,
      livello: values.livello ?? null,
      stato: values.stato,
      videoScaricabile: Boolean(values.videoScaricabile),
    };

    // Campi di vendita: inviati solo se il modulo pagamenti è attivo. Il prezzo
    // in euro è convertito in centesimi (intero) per il backend.
    if (pagamentiAttivo) {
      payload.acquistabile = Boolean(values.acquistabile);
      payload.prezzoCentesimi = values.prezzoEuro
        ? Math.round(parseFloat(String(values.prezzoEuro).replace(',', '.')) * 100)
        : null;
      payload.valuta = values.valuta || 'EUR';
      payload.descrizioneVendita = values.descrizioneVendita ?? null;
      payload.aulaDestinazioneId = values.aulaDestinazioneId || null;
    }

    try {
      if (isEdit) {
        await updateCorso.mutateAsync({ id: corso.id, ...payload });
        toast.success(t('corsi.toast.updated'));
      } else {
        if (requireScuola && values.scuolaId) payload.scuolaId = values.scuolaId;
        await createCorso.mutateAsync(payload);
        toast.success(t('corsi.toast.created'));
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          // Il backend valida `prezzoCentesimi`; nel form il campo è `prezzoEuro`.
          const campo = field === 'prezzoCentesimi' ? 'prezzoEuro' : field;
          if (CAMPI.includes(campo)) setError(campo, { type: 'server', message });
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = createCorso.isPending || updateCorso.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('corsi.form.editTitle') : t('corsi.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="corso-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('corsi.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="corso-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <TextField
          label={t('corsi.form.titolo')}
          required
          error={errors.titolo?.message}
          {...register('titolo')}
        />
        <TextArea
          label={t('corsi.form.descrizione')}
          rows={3}
          error={errors.descrizione?.message}
          {...register('descrizione')}
        />
        <TextField
          label={t('corsi.form.copertinaUrl')}
          hint={t('corsi.form.copertinaHint')}
          error={errors.copertinaUrl?.message}
          {...register('copertinaUrl')}
        />
        <div className={styles.formRow}>
          <VocabolarioField
            vocabolario="materieDisponibili"
            label={t('corsi.form.materia')}
            placeholder={t('corsi.form.materiaQualsiasi')}
            maxLength={MATERIA_MAX}
            error={errors.materia?.message}
            {...register('materia')}
          />
          <VocabolarioField
            vocabolario="livelliDisponibili"
            label={t('corsi.form.livello')}
            placeholder={t('corsi.form.livelloQualsiasi')}
            maxLength={LIVELLO_MAX}
            error={errors.livello?.message}
            {...register('livello')}
          />
        </div>

        <div className={styles.formRow}>
          <Select
            label={t('corsi.form.stato')}
            required
            error={errors.stato?.message}
            {...register('stato')}
          >
            {STATI_CORSO.map((stato) => (
              <option key={stato} value={stato}>
                {t(`corsi.stati.${stato}`)}
              </option>
            ))}
          </Select>
        </div>

        {requireScuola && (
          <ScuolaSelect
            required
            error={errors.scuolaId?.message}
            {...register('scuolaId')}
          />
        )}

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('videoScaricabile')} />
          <span className={styles.checkboxLabel}>
            <span className={styles.checkboxTitle}>
              {t('corsi.form.videoScaricabile')}
            </span>
            <span className={styles.checkboxHint}>
              {t('corsi.form.videoScaricabileHint')}
            </span>
          </span>
        </label>

        {pagamentiAttivo && (
          <div className={pagamentiStyles.venditaSection}>
            <h3 className={pagamentiStyles.venditaTitle}>
              {t('pagamenti.form.sezioneTitolo')}
            </h3>

            <label className={styles.checkboxField}>
              <input type="checkbox" {...register('acquistabile')} />
              <span className={styles.checkboxLabel}>
                <span className={styles.checkboxTitle}>
                  {t('pagamenti.form.acquistabile')}
                </span>
                <span className={styles.checkboxHint}>
                  {t('pagamenti.form.acquistabileHint')}
                </span>
              </span>
            </label>

            <div className={styles.formRow}>
              <TextField
                label={t('pagamenti.form.prezzo')}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                disabled={!acquistabile}
                error={errors.prezzoEuro?.message}
                {...register('prezzoEuro')}
              />
              <Select
                label={t('pagamenti.form.valuta')}
                disabled={!acquistabile}
                error={errors.valuta?.message}
                {...register('valuta')}
              >
                {VALUTE_SUPPORTATE.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>

            <Select
              label={t('pagamenti.form.aulaDestinazione')}
              hint={t('pagamenti.form.aulaDestinazioneHint')}
              disabled={!acquistabile}
              error={errors.aulaDestinazioneId?.message}
              {...register('aulaDestinazioneId')}
            >
              <option value="">{t('pagamenti.form.aulaPlaceholder')}</option>
              {aule.map((aula) => (
                <option key={aula.id} value={aula.id}>
                  {aula.nome}
                </option>
              ))}
            </Select>

            <TextArea
              label={t('pagamenti.form.descrizioneVendita')}
              hint={t('pagamenti.form.descrizioneVenditaHint')}
              rows={3}
              disabled={!acquistabile}
              error={errors.descrizioneVendita?.message}
              {...register('descrizioneVendita')}
            />
          </div>
        )}
      </form>
    </Modal>
  );
};

export default CorsoFormModal;
