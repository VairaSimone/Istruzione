import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildMessaggioSchema } from '../../../validators/messaggiSchemas';
import { useInviaMessaggio } from '../../../hooks/useMessaggi';
import { useAuleList, useAula } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { TIPI_MESSAGGIO_COMPONIBILI } from '../../../constants/domain';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import TextArea from '../../../components/ui/TextArea';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Messaggi.module.css';

/**
 * Composizione messaggio (docente): a un'aula o a un singolo studente, oppure
 * nota privata (visibile solo all'autore, con riferimento facoltativo a uno
 * studente). Il feedback sui compiti si crea dai compiti, non da qui.
 */
const ComposeMessaggioModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const invia = useInviaMessaggio();

  const [tipo, setTipo] = useState('messaggio');
  const [mode, setMode] = useState('classe');
  const [classeId, setClasseId] = useState('');
  const [utenteId, setUtenteId] = useState('');

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];
  const { data: aula } = useAula(classeId || undefined);
  const studenti = aula?.studenti ?? [];

  const isNota = tipo === 'nota_privata';
  const needsStudent = isNota ? false : mode === 'studente';

  const schema = useMemo(() => buildMessaggioSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { oggetto: '', corpo: '', consentiRisposte: true },
  });

  const onSubmit = async (values) => {
    const payload = { tipo, corpo: values.corpo };
    if (values.oggetto) payload.oggetto = values.oggetto;

    if (isNota) {
      if (utenteId) payload.notaSuUtenteId = utenteId;
    } else {
      payload.consentiRisposte = values.consentiRisposte;
      if (mode === 'classe') {
        if (!classeId) return toast.error(t('messaggi.compose.selectTargetError'));
        payload.classeId = classeId;
      } else {
        if (!utenteId) return toast.error(t('messaggi.compose.selectTargetError'));
        payload.studenteId = utenteId;
      }
    }

    try {
      await invia.mutateAsync(payload);
      toast.success(t('messaggi.compose.success'));
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
    return undefined;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={t('messaggi.compose.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={invia.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="compose-form" isLoading={invia.isPending}>
            {t('messaggi.compose.submit')}
          </Button>
        </>
      }
    >
      <form id="compose-form" onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <Select
          label={t('messaggi.compose.tipo')}
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setUtenteId('');
          }}
        >
          {TIPI_MESSAGGIO_COMPONIBILI.map((tp) => (
            <option key={tp} value={tp}>
              {t(`messaggi.tipi.${tp}`)}
            </option>
          ))}
        </Select>

        {!isNota && (
          <div className={styles.toggle}>
            <Button
              variant={mode === 'classe' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setMode('classe');
                setUtenteId('');
              }}
            >
              {t('messaggi.compose.toClass')}
            </Button>
            <Button
              variant={mode === 'studente' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('studente')}
            >
              {t('messaggi.compose.toStudent')}
            </Button>
          </div>
        )}

        <Select
          label={isNota ? t('messaggi.compose.aulaNota') : t('messaggi.compose.aula')}
          placeholder={t('messaggi.compose.selectAula')}
          value={classeId}
          onChange={(e) => {
            setClasseId(e.target.value);
            setUtenteId('');
          }}
        >
          {aule.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>

        {(needsStudent || (isNota && classeId)) && (
          <Select
            label={isNota ? t('messaggi.compose.studenteNota') : t('messaggi.compose.studente')}
            placeholder={t('messaggi.compose.selectStudente')}
            value={utenteId}
            onChange={(e) => setUtenteId(e.target.value)}
          >
            {studenti.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.cognome}
              </option>
            ))}
          </Select>
        )}

        <TextField
          label={t('messaggi.compose.oggetto')}
          error={errors.oggetto?.message}
          {...register('oggetto')}
        />
        <TextArea
          label={t('messaggi.compose.corpo')}
          required
          rows={5}
          error={errors.corpo?.message}
          {...register('corpo')}
        />

        {!isNota && (
          <label className={styles.checkboxRow}>
            <input type="checkbox" {...register('consentiRisposte')} />
            {t('messaggi.compose.consentiRisposte')}
          </label>
        )}
      </form>
    </Modal>
  );
};

export default ComposeMessaggioModal;
