import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  buildScuolaSchema,
  parseImpostazioni,
  slugificaAnteprima,
} from '../../../validators/scuoleSchemas';
import { useCreateScuola, useUpdateScuola } from '../../../hooks/useScuole';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { parseApiError } from '../../../utils/parseApiError';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Button from '../../../components/ui/Button';
import DominiEditor from './DominiEditor';
import styles from './Scuole.module.css';

const CAMPI = ['nome', 'slug', 'attiva', 'predefinita', 'impostazioniText'];

/**
 * Modal per creare (scuola = null) o modificare una scuola. Riservato all'admin.
 *
 * Lo SLUG è l'identificativo pubblico del tenant: compare in `?scuola=<slug>` e
 * nell'header `X-Scuola`, e permette al frontend di caricare il branding giusto
 * prima ancora del login. Lasciandolo vuoto lo deriva il backend dal nome; qui
 * ne mostriamo l'anteprima, perché uno slug generato a sorpresa è uno slug che
 * poi nessuno ritrova.
 *
 * `predefinita` marca la scuola servita quando nessun tenant è indicato: è
 * quella dei deploy mono-scuola. Il backend garantisce che ce ne sia una sola.
 *
 * Le impostazioni restano modificabili come JSON per gli usi avanzati: la
 * configurazione ordinaria si fa nella pagina «Impostazioni scuola», con un
 * form generato dallo schema.
 */
const ScuolaFormModal = ({ isOpen, onClose, scuola = null }) => {
  const { t } = useTranslation();
  const createScuola = useCreateScuola();
  const updateScuola = useUpdateScuola();
  const isEdit = Boolean(scuola);

  const schema = useMemo(() => buildScuolaSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const nome = useWatch({ control, name: 'nome' });
  const slug = useWatch({ control, name: 'slug' });
  const slugAnteprima = slug?.trim() ? slug.trim() : slugificaAnteprima(nome ?? '');

  useEffect(() => {
    if (!isOpen) return;
    reset({
      nome: scuola?.nome ?? '',
      slug: scuola?.slug ?? '',
      attiva: scuola?.attiva ?? true,
      predefinita: scuola?.predefinita ?? false,
      impostazioniText:
        scuola?.impostazioni && Object.keys(scuola.impostazioni).length > 0
          ? JSON.stringify(scuola.impostazioni, null, 2)
          : '',
    });
  }, [isOpen, scuola, reset]);

  const onSubmit = async (values) => {
    let impostazioni;
    try {
      impostazioni = parseImpostazioni(values.impostazioniText);
    } catch {
      setError('impostazioniText', {
        type: 'validate',
        message: t('scuole.validation.impostazioniJson'),
      });
      return;
    }

    const comune = {
      nome: values.nome,
      attiva: Boolean(values.attiva),
      predefinita: Boolean(values.predefinita),
      ...(values.slug ? { slug: values.slug } : {}),
    };

    try {
      if (isEdit) {
        await updateScuola.mutateAsync({
          id: scuola.id,
          ...comune,
          // In modifica inviamo sempre le impostazioni (vuoto ⇒ {} esplicito).
          impostazioni: impostazioni ?? {},
        });
        toast.success(t('scuole.toast.updated'));
      } else {
        await createScuola.mutateAsync({
          ...comune,
          ...(impostazioni !== undefined ? { impostazioni } : {}),
        });
        toast.success(t('scuole.toast.created'));
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([field, message]) => {
          if (CAMPI.includes(field)) setError(field, { type: 'server', message });
          if (field === 'impostazioni') {
            setError('impostazioniText', { type: 'server', message });
          }
        });
      }
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const isPending = createScuola.isPending || updateScuola.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('scuole.form.editTitle') : t('scuole.form.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="scuola-form" isLoading={isPending}>
            {isEdit ? t('common.save') : t('scuole.form.createSubmit')}
          </Button>
        </>
      }
    >
      <form
        id="scuola-form"
        onSubmit={handleSubmit(onSubmit)}
        className={styles.inlineForm}
        noValidate
      >
        <TextField
          label={t('scuole.form.nome')}
          required
          error={errors.nome?.message}
          {...register('nome')}
        />

        <TextField
          label={t('scuole.form.slug')}
          placeholder={slugAnteprima || 'liceo-rossi'}
          hint={
            slugAnteprima
              ? t('scuole.form.slugAnteprima', { slug: slugAnteprima })
              : t('scuole.form.slugHint')
          }
          error={errors.slug?.message}
          {...register('slug')}
        />

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('attiva')} />
          <span className={styles.checkboxLabel}>
            <span className={styles.checkboxTitle}>{t('scuole.form.attiva')}</span>
            <span className={styles.checkboxHint}>{t('scuole.form.attivaHint')}</span>
          </span>
        </label>

        <label className={styles.checkboxField}>
          <input type="checkbox" {...register('predefinita')} />
          <span className={styles.checkboxLabel}>
            <span className={styles.checkboxTitle}>{t('scuole.form.predefinita')}</span>
            <span className={styles.checkboxHint}>{t('scuole.form.predefinitaHint')}</span>
          </span>
        </label>

        <div className={styles.jsonArea}>
          <TextArea
            label={t('scuole.form.impostazioni')}
            rows={8}
            placeholder={'{\n  "identita": { "nomeVisualizzato": "Liceo Rossi" }\n}'}
            hint={t('scuole.form.impostazioniHint')}
            error={errors.impostazioniText?.message}
            {...register('impostazioniText')}
          />
        </div>
      </form>

      {/* Domini della scuola: disponibili solo in modifica (serve l'id). L'admin
          può anche verificarli. Sono una risorsa a sé, con salvataggio proprio. */}
      {isEdit && (
        <div className={styles.dominiArea}>
          <DominiEditor scuolaId={scuola.id} isAdmin />
        </div>
      )}
    </Modal>
  );
};

export default ScuolaFormModal;
