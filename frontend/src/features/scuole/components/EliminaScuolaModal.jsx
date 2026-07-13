import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useDeleteScuola } from '../../../hooks/useScuole';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Modal from '../../../components/ui/Modal';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import styles from './Scuole.module.css';

/**
 * EliminaScuolaModal — conferma FORTE per l'eliminazione DEFINITIVA di una
 * scuola e di tutti i suoi dati (utenti, corsi, video/immagini, compiti,
 * messaggi, quiz, certificati…). Operazione irreversibile.
 *
 * Per prevenire clic accidentali, il pulsante di conferma si abilita solo dopo
 * che l'admin ha DIGITATO ESATTAMENTE il nome della scuola. La cancellazione
 * usa la modalità `forza`, che rimuove anche i binari su disco.
 *
 * Il componente è montato dal genitore SOLO quando aperto: lo stato del campo
 * di conferma nasce così pulito a ogni apertura, senza effetti collaterali.
 */
const EliminaScuolaModal = ({ isOpen, onClose, scuola }) => {
  const { t } = useTranslation();
  const deleteScuola = useDeleteScuola();
  const [conferma, setConferma] = useState('');

  if (!scuola) return null;

  const nomeCorrisponde = conferma.trim() === scuola.nome;

  const handleDelete = async () => {
    if (!nomeCorrisponde) return;
    try {
      await deleteScuola.mutateAsync({ id: scuola.id, forza: true });
      toast.success(t('scuole.delete.doneForced'));
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={t('scuole.delete.forcedTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleteScuola.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!nomeCorrisponde}
            isLoading={deleteScuola.isPending}
          >
            {t('scuole.delete.forcedConfirm')}
          </Button>
        </>
      }
    >
      <div className={styles.inlineForm}>
        <p className={styles.dangerText}>
          {t('scuole.delete.forcedWarning', { nome: scuola.nome })}
        </p>
        <TextField
          label={t('scuole.delete.typeNameLabel', { nome: scuola.nome })}
          placeholder={scuola.nome}
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Modal>
  );
};

export default EliminaScuolaModal;
