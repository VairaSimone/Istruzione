import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { buildContattoSchema, TIPI_RICHIESTA } from '../../../validators/contattiSchemas';
import { useInviaRichiesta } from '../../../hooks/useContatti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Homepage.module.css';

/**
 * FORM DI CONTATTO della homepage pubblica.
 *
 * Invia una richiesta a `POST /api/contatti` (nessuna autenticazione): la scuola
 * destinataria è risolta lato server dal dominio o dal tenant indicato. I tipi
 * di richiesta mostrati sono SOLO quelli abilitati dalla scuola
 * (`homepage.form.tipiRichiesta`).
 *
 * Contiene un HONEYPOT (`website`) nascosto sia alla vista sia ai lettori di
 * schermo: un bot che lo compila viene scartato dal backend.
 *
 * @param {string[]} tipiRichiesta  tipi ammessi dalla scuola
 * @param {string}   tipoIniziale   tipo preselezionato (da una CTA della hero)
 * @param {string}   [id]           ancora per lo scroll dalle CTA
 */
const ContattoForm = ({ tipiRichiesta = TIPI_RICHIESTA, tipoIniziale, id }) => {
  const { t } = useTranslation();
  const inviaRichiesta = useInviaRichiesta();
  const [conferma, setConferma] = useState(null);
  const [erroreInvio, setErroreInvio] = useState(null);

  const tipi = tipiRichiesta.length ? tipiRichiesta : TIPI_RICHIESTA;
  const tipoDefault = tipi.includes(tipoIniziale) ? tipoIniziale : tipi[0];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(buildContattoSchema(t, tipi)),
    defaultValues: { tipo: tipoDefault, nome: '', email: '', telefono: '', messaggio: '', website: '' },
  });

  // Una CTA della hero può cambiare il tipo dopo il mount (es. "Iscriviti").
  useEffect(() => {
    if (tipi.includes(tipoIniziale)) setValue('tipo', tipoIniziale);
  }, [tipoIniziale, tipi, setValue]);

  const onSubmit = async (values) => {
    setErroreInvio(null);
    try {
      const esito = await inviaRichiesta.mutateAsync(values);
      setConferma(esito?.messaggioConferma || t('contatti.form.confermaDefault'));
      reset({ tipo: tipoDefault, nome: '', email: '', telefono: '', messaggio: '', website: '' });
    } catch (err) {
      setErroreInvio(getApiErrorMessage(t, err));
    }
  };

  if (conferma) {
    return (
      <div className={styles.formConferma} role="status" id={id}>
        <div className={styles.formConfermaIcona} aria-hidden="true">✓</div>
        <p className={styles.formConfermaTesto}>{conferma}</p>
        <Button variant="secondary" onClick={() => setConferma(null)}>
          {t('contatti.form.nuovaRichiesta')}
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} id={id} noValidate>
      {tipi.length > 1 && (
        <Select label={t('contatti.form.tipo')} {...register('tipo')} error={errors.tipo?.message}>
          {tipi.map((tp) => (
            <option key={tp} value={tp}>
              {t(`contatti.tipi.${tp}`, { defaultValue: tp })}
            </option>
          ))}
        </Select>
      )}

      <TextField
        label={t('contatti.form.nome')}
        required
        {...register('nome')}
        error={errors.nome?.message}
        autoComplete="name"
      />

      <TextField
        label={t('contatti.form.email')}
        type="email"
        required
        {...register('email')}
        error={errors.email?.message}
        autoComplete="email"
      />

      <TextField
        label={t('contatti.form.telefono')}
        type="tel"
        {...register('telefono')}
        error={errors.telefono?.message}
        autoComplete="tel"
      />

      <TextArea
        label={t('contatti.form.messaggio')}
        rows={5}
        {...register('messaggio')}
        error={errors.messaggio?.message}
      />

      {/* Honeypot anti-bot: fuori dal flusso e nascosto agli screen reader. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="website-hp">Website</label>
        <input id="website-hp" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {erroreInvio && (
        <p className={styles.formErrore} role="alert">
          {erroreInvio}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={inviaRichiesta.isPending}>
        {t('contatti.form.invia')}
      </Button>
    </form>
  );
};

export default ContattoForm;
