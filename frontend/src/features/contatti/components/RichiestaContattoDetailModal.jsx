import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { STATI_RICHIESTA } from '../../../validators/contattiSchemas';
import { useUpdateRichiesta, useDeleteRichiesta } from '../../../hooks/useContatti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { formatDateTime } from '../../../utils/datetime';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import TextArea from '../../../components/ui/TextArea';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './Contatti.module.css';

/**
 * Dettaglio e GESTIONE di un lead: cambio stato, presa in carico, note interne,
 * eliminazione. Lo staff risponde direttamente via email (mailto), fuori dalla
 * piattaforma: il lead resta traccia della richiesta.
 */
const RichiestaContattoDetailModal = ({ richiesta, isOpen, onClose }) => {
  const { t } = useTranslation();
  const updateRichiesta = useUpdateRichiesta();
  const deleteRichiesta = useDeleteRichiesta();

  // Lo stato locale è inizializzato dai prop; il componente viene RIMONTATO dal
  // padre (via `key={richiesta.id}`) a ogni cambio di selezione, quindi non
  // serve un effetto di sincronizzazione.
  const [stato, setStato] = useState(richiesta?.stato ?? 'nuova');
  const [note, setNote] = useState(richiesta?.noteInterne ?? '');
  const [confermaElimina, setConfermaElimina] = useState(false);

  if (!richiesta) return null;

  const salva = async ({ prendiInCarico } = {}) => {
    try {
      await updateRichiesta.mutateAsync({
        id: richiesta.id,
        stato,
        noteInterne: note.trim() === '' ? null : note,
        ...(prendiInCarico !== undefined ? { prendiInCarico } : {}),
      });
      toast.success(t('contatti.toast.aggiornata'));
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const elimina = async () => {
    try {
      await deleteRichiesta.mutateAsync(richiesta.id);
      toast.success(t('contatti.toast.eliminata'));
      setConfermaElimina(false);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
      setConfermaElimina(false);
    }
  };

  const oggettoMail = t('contatti.mailto.oggetto', {
    tipo: t(`contatti.tipi.${richiesta.tipo}`, { defaultValue: richiesta.tipo }),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={t('contatti.dettaglio.titolo')}
      footer={
        <>
          <Button variant="danger" onClick={() => setConfermaElimina(true)}>
            {t('common.delete')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button onClick={() => salva()} isLoading={updateRichiesta.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className={styles.dettaglio}>
        <div className={styles.dettaglioGriglia}>
          <span className={styles.dettaglioLabel}>{t('contatti.form.nome')}</span>
          <span className={styles.dettaglioValore}>{richiesta.nome}</span>

          <span className={styles.dettaglioLabel}>{t('contatti.form.email')}</span>
          <span className={styles.dettaglioValore}>
            <a href={`mailto:${richiesta.email}?subject=${encodeURIComponent(oggettoMail)}`}>
              {richiesta.email}
            </a>
          </span>

          {richiesta.telefono && (
            <>
              <span className={styles.dettaglioLabel}>{t('contatti.form.telefono')}</span>
              <span className={styles.dettaglioValore}>
                <a href={`tel:${richiesta.telefono}`}>{richiesta.telefono}</a>
              </span>
            </>
          )}

          <span className={styles.dettaglioLabel}>{t('contatti.dettaglio.tipo')}</span>
          <span className={styles.dettaglioValore}>
            <Badge tone="neutral">
              {t(`contatti.tipi.${richiesta.tipo}`, { defaultValue: richiesta.tipo })}
            </Badge>
          </span>

          <span className={styles.dettaglioLabel}>{t('contatti.dettaglio.ricevuta')}</span>
          <span className={styles.dettaglioValore}>{formatDateTime(richiesta.created_at)}</span>
        </div>

        {richiesta.messaggio && <div className={styles.messaggio}>{richiesta.messaggio}</div>}

        <div className={styles.dettaglioAzioni}>
          <div className={styles.statoSelect}>
            <Select
              label={t('contatti.dettaglio.stato')}
              value={stato}
              onChange={(e) => setStato(e.target.value)}
            >
              {STATI_RICHIESTA.map((s) => (
                <option key={s} value={s}>
                  {t(`contatti.stati.${s}`, { defaultValue: s })}
                </option>
              ))}
            </Select>
          </div>
          {!richiesta.gestitaDa && (
            <Button
              variant="secondary"
              onClick={() => salva({ prendiInCarico: true })}
              isLoading={updateRichiesta.isPending}
            >
              {t('contatti.dettaglio.prendiInCarico')}
            </Button>
          )}
        </div>

        <TextArea
          label={t('contatti.dettaglio.noteInterne')}
          rows={3}
          value={note}
          maxLength={4000}
          hint={t('contatti.dettaglio.noteInterneHint')}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <ConfirmDialog
        isOpen={confermaElimina}
        title={t('contatti.elimina.titolo')}
        description={t('contatti.elimina.descrizione')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isLoading={deleteRichiesta.isPending}
        onConfirm={elimina}
        onCancel={() => setConfermaElimina(false)}
      />
    </Modal>
  );
};

export default RichiestaContattoDetailModal;
