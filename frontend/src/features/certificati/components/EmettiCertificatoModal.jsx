import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildEmettiCertificatoSchema } from '../../../validators/certificatiSchemas';
import { useEmettiCertificato } from '../../../hooks/useCertificati';
import { useAuleList, useAula } from '../../../hooks/useAule';
import { useCorsiList } from '../../../hooks/useCorsi';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Certificati.module.css';

const CAMPI = ['utenteId', 'corsoId', 'nomeCorso', 'esito', 'dataCompletamento', 'titolo'];

/** Data di oggi in formato YYYY-MM-DD per il valore predefinito del campo data. */
const oggiIso = () => new Date().toISOString().slice(0, 10);

/**
 * Rilascio di un CERTIFICATO (staff).
 *
 * Lo studente si sceglie selezionando prima una delle proprie AULE e poi uno
 * studente al suo interno (il backend accetta solo studenti delle proprie aule).
 * Il percorso può essere un CORSO della scuola oppure un nome a testo libero.
 * Titolo/testi grafici del certificato vengono dal modello della scuola
 * (personalizzabile nelle impostazioni): qui si può solo, facoltativamente,
 * sovrascrivere il titolo.
 */
const EmettiCertificatoModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const emetti = useEmettiCertificato();

  const [classeId, setClasseId] = useState('');
  // Corso selezionato in stato locale (evita `watch()`, incompatibile con React
  // Compiler); serve solo a disabilitare il nome libero del percorso.
  const [corsoIdSel, setCorsoIdSel] = useState('');

  const schema = useMemo(() => buildEmettiCertificatoSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const corsoReg = register('corsoId');

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];

  const { data: aula } = useAula(classeId || undefined);
  const studenti = aula?.studenti ?? [];

  // Corsi della scuola per il selettore del percorso (facoltativo).
  const { data: corsiData } = useCorsiList({ limit: 100 });
  const corsi = corsiData?.corsi ?? [];

  // Solo la reset() di react-hook-form nell'effetto (non è setState di React):
  // i valori del form tornano ai default a ogni apertura.
  useEffect(() => {
    if (!isOpen) return;
    reset({
      utenteId: '',
      corsoId: '',
      nomeCorso: '',
      esito: '',
      dataCompletamento: oggiIso(),
      titolo: '',
    });
  }, [isOpen, reset]);

  // Lo stato locale della UI (aula/corso selezionati) si azzera alla chiusura,
  // in un gestore di evento: così non serve un setState dentro l'effetto.
  const handleClose = () => {
    setClasseId('');
    setCorsoIdSel('');
    onClose();
  };

  const onSubmit = async (values) => {
    const payload = {
      utenteId: values.utenteId,
      corsoId: values.corsoId || undefined,
      nomeCorso: values.nomeCorso || undefined,
      esito: values.esito || undefined,
      dataCompletamento: values.dataCompletamento || undefined,
      titolo: values.titolo || undefined,
    };

    try {
      await emetti.mutateAsync(payload);
      toast.success(t('certificati.toast.emesso'));
      handleClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={t('certificati.form.title')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={emetti.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="certificato-form" isLoading={emetti.isPending}>
            {t('certificati.form.submit')}
          </Button>
        </>
      }
    >
      <form
        id="certificato-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
      >
        <p className={styles.hintBlock}>{t('certificati.form.intro')}</p>

        <div className={styles.formRow}>
          {/* Selettore aula (solo per filtrare gli studenti; non inviato). */}
          <Select
            label={t('certificati.form.aula')}
            placeholder={t('certificati.form.aulaPlaceholder')}
            value={classeId}
            onChange={(e) => {
              setClasseId(e.target.value);
              setValue('utenteId', '');
            }}
          >
            {aule.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>

          <Select
            label={t('certificati.form.studente')}
            required
            placeholder={t('certificati.form.studentePlaceholder')}
            error={errors.utenteId?.message}
            disabled={!classeId}
            {...register('utenteId')}
          >
            {studenti.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.cognome}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.formRow}>
          <Select
            label={t('certificati.form.corso')}
            placeholder={t('certificati.form.corsoPlaceholder')}
            error={errors.corsoId?.message}
            {...corsoReg}
            onChange={(e) => {
              corsoReg.onChange(e);
              setCorsoIdSel(e.target.value);
            }}
          >
            {corsi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titolo}
              </option>
            ))}
          </Select>

          <TextField
            label={t('certificati.form.nomeCorso')}
            hint={t('certificati.form.nomeCorsoHint')}
            error={errors.nomeCorso?.message}
            disabled={Boolean(corsoIdSel)}
            {...register('nomeCorso')}
          />
        </div>

        <div className={styles.formRow}>
          <TextField
            label={t('certificati.form.dataCompletamento')}
            type="date"
            error={errors.dataCompletamento?.message}
            {...register('dataCompletamento')}
          />
          <TextField
            label={t('certificati.form.esito')}
            hint={t('certificati.form.esitoHint')}
            error={errors.esito?.message}
            {...register('esito')}
          />
        </div>

        <TextField
          label={t('certificati.form.titolo')}
          hint={t('certificati.form.titoloHint')}
          error={errors.titolo?.message}
          {...register('titolo')}
        />
      </form>
    </Modal>
  );
};

export default EmettiCertificatoModal;
