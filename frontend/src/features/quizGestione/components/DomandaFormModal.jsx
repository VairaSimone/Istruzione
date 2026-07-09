import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  buildDomandaSchema,
  domandaFormToPayload,
  domandaToFormValues,
} from '../../../validators/quizGestioneSchemas';
import { useAddDomanda, useUpdateDomanda } from '../../../hooks/useQuizGestione';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { TIPI_DOMANDA, OPZIONI_MAX, OPZIONI_MIN } from '../../../constants/quizGestione';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './QuizGestione.module.css';

/** Opzioni predefinite di una domanda vero/falso. */
const OPZIONI_VERO_FALSO = (t) => [
  { testo: t('quizGestione.domanda.vero'), corretta: true },
  { testo: t('quizGestione.domanda.falso'), corretta: false },
];

/**
 * Crea o modifica una domanda di un quiz PERSONALIZZATO (i quiz da template
 * generano le proprie domande e non hanno righe in database).
 *
 * La soluzione si indica con un radio: esattamente una opzione corretta, come
 * pretende il backend. Per le domande a risposta breve si accettano alternative
 * separate da punto e virgola, con confronto opzionalmente sensibile a
 * maiuscole/minuscole.
 */
const DomandaFormModal = ({ isOpen, onClose, quizId, domanda = null }) => {
  const { t } = useTranslation();
  const addDomanda = useAddDomanda();
  const updateDomanda = useUpdateDomanda();
  const isEdit = Boolean(domanda);

  const schema = useMemo(() => buildDomandaSchema(t), [t]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'opzioni' });

  // `useWatch` (a differenza di `watch`) è memoizzabile e non forza il
  // compilatore React a saltare l'ottimizzazione del componente.
  const tipo = useWatch({ control, name: 'tipo' });
  const opzioni = useWatch({ control, name: 'opzioni' }) ?? [];
  const indiceCorretta = opzioni.findIndex((o) => o?.corretta === true);

  useEffect(() => {
    if (!isOpen) return;
    reset(domandaToFormValues(domanda));
  }, [isOpen, domanda, reset]);

  // Cambiando tipo si adatta il vettore delle opzioni (le regole di forma sono
  // diverse: vero/falso ne vuole esattamente 2, la risposta breve nessuna).
  const handleCambioTipo = (nuovoTipo) => {
    setValue('tipo', nuovoTipo);
    if (nuovoTipo === 'vero_falso') replace(OPZIONI_VERO_FALSO(t));
    else if (nuovoTipo === 'risposta_breve') replace([]);
    else if (opzioni.length < OPZIONI_MIN) {
      replace([
        { testo: '', corretta: true },
        { testo: '', corretta: false },
      ]);
    }
  };

  // Il radio della soluzione: azzera le altre opzioni.
  const selezionaCorretta = (indice) => {
    opzioni.forEach((_, i) => setValue(`opzioni.${i}.corretta`, i === indice));
  };

  const onSubmit = async (values) => {
    const payload = domandaFormToPayload(values);
    try {
      if (isEdit) {
        await updateDomanda.mutateAsync({ id: quizId, domandaId: domanda.id, ...payload });
        toast.success(t('quizGestione.toast.domandaUpdated'));
      } else {
        await addDomanda.mutateAsync({ id: quizId, ...payload });
        toast.success(t('quizGestione.toast.domandaAdded'));
      }
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = addDomanda.isPending || updateDomanda.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        isEdit ? t('quizGestione.domanda.editTitle') : t('quizGestione.domanda.createTitle')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="domanda-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('common.add')}
          </Button>
        </>
      }
    >
      <form
        id="domanda-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <Select
          label={t('quizGestione.domanda.tipo')}
          required
          error={errors.tipo?.message}
          value={tipo ?? 'scelta_multipla'}
          onChange={(e) => handleCambioTipo(e.target.value)}
        >
          {TIPI_DOMANDA.map((tipoDomanda) => (
            <option key={tipoDomanda} value={tipoDomanda}>
              {t(`quizGestione.domanda.tipi.${tipoDomanda}`)}
            </option>
          ))}
        </Select>

        <TextArea
          label={t('quizGestione.domanda.testo')}
          required
          rows={2}
          error={errors.testo?.message}
          {...register('testo')}
        />

        <TextField
          label={t('quizGestione.domanda.mediaUrl')}
          hint={t('quizGestione.domanda.mediaUrlHint')}
          error={errors.mediaUrl?.message}
          {...register('mediaUrl')}
        />

        {/* ── Domande a scelta ── */}
        {tipo !== 'risposta_breve' && (
          <fieldset>
            <legend className={styles.legend}>{t('quizGestione.domanda.opzioni')}</legend>
            <p className={styles.opzioniHint}>{t('quizGestione.domanda.opzioniHint')}</p>

            <div className={styles.opzioniEditor}>
              {fields.map((field, indice) => (
                <div key={field.id} className={styles.opzioneEditorRow}>
                  <input
                    type="radio"
                    className={styles.opzioneRadio}
                    name="opzione-corretta"
                    checked={indiceCorretta === indice}
                    onChange={() => selezionaCorretta(indice)}
                    aria-label={t('quizGestione.domanda.segnaCorretta')}
                  />
                  <TextField
                    label={t('quizGestione.domanda.opzioneN', { n: indice + 1 })}
                    error={errors.opzioni?.[indice]?.testo?.message}
                    {...register(`opzioni.${indice}.testo`)}
                  />
                  {tipo === 'scelta_multipla' && fields.length > OPZIONI_MIN && (
                    <Button variant="ghost" size="sm" onClick={() => remove(indice)}>
                      {t('common.remove')}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {errors.opzioni?.message && (
              <p className={styles.fieldError} role="alert">
                {errors.opzioni.message}
              </p>
            )}

            {tipo === 'scelta_multipla' && fields.length < OPZIONI_MAX && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => append({ testo: '', corretta: false })}
              >
                {t('quizGestione.domanda.aggiungiOpzione')}
              </Button>
            )}
          </fieldset>
        )}

        {/* ── Risposta breve ── */}
        {tipo === 'risposta_breve' && (
          <>
            <TextField
              label={t('quizGestione.domanda.rispostaCorretta')}
              required
              error={errors.rispostaCorretta?.message}
              {...register('rispostaCorretta')}
            />
            <TextField
              label={t('quizGestione.domanda.risposteAlternative')}
              hint={t('quizGestione.domanda.risposteAlternativeHint')}
              error={errors.risposteAlternative?.message}
              {...register('risposteAlternative')}
            />
            <label className={styles.checkboxField}>
              <input type="checkbox" {...register('caseSensitive')} />
              <span className={styles.checkboxLabel}>
                <span className={styles.checkboxTitle}>
                  {t('quizGestione.domanda.caseSensitive')}
                </span>
                <span className={styles.checkboxHint}>
                  {t('quizGestione.domanda.caseSensitiveHint')}
                </span>
              </span>
            </label>
          </>
        )}

        <TextArea
          label={t('quizGestione.domanda.spiegazione')}
          hint={t('quizGestione.domanda.spiegazioneHint')}
          rows={2}
          error={errors.spiegazione?.message}
          {...register('spiegazione')}
        />
      </form>
    </Modal>
  );
};

export default DomandaFormModal;
