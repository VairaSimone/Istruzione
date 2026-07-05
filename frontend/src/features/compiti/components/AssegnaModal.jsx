import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAddAssegnazione } from '../../../hooks/useCompiti';
import { useAuleList, useAula } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

/**
 * Assegna un compito a un'AULA oppure a un SINGOLO studente.
 * In modalità "studente" si sceglie prima un'aula, poi uno dei suoi studenti
 * (il backend accetta solo studenti delle proprie aule).
 */
const AssegnaModal = ({ isOpen, onClose, compitoId }) => {
  const { t } = useTranslation();
  const addAssegnazione = useAddAssegnazione();
  const [mode, setMode] = useState('classe');
  const [classeId, setClasseId] = useState('');
  const [utenteId, setUtenteId] = useState('');

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];

  // In modalità studente carichiamo i membri dell'aula scelta.
  const { data: aula } = useAula(mode === 'studente' ? classeId : undefined);
  const studenti = aula?.studenti ?? [];

  const reset = () => {
    setMode('classe');
    setClasseId('');
    setUtenteId('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      if (mode === 'classe') {
        if (!classeId) return;
        await addAssegnazione.mutateAsync({ id: compitoId, classeId });
      } else {
        if (!utenteId) return;
        await addAssegnazione.mutateAsync({ id: compitoId, utenteId });
      }
      toast.success(t('compiti.toast.assigned'));
      handleClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('compiti.assegna.title')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={addAssegnazione.isPending}>
            {t('compiti.assegna.submit')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.toggle}>
          <Button
            variant={mode === 'classe' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('classe')}
          >
            {t('compiti.assegna.toClass')}
          </Button>
          <Button
            variant={mode === 'studente' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('studente')}
          >
            {t('compiti.assegna.toStudent')}
          </Button>
        </div>

        <Select
          label={t('compiti.assegna.aula')}
          placeholder={t('compiti.assegna.selectAula')}
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

        {mode === 'studente' && classeId && (
          <Select
            label={t('compiti.assegna.studente')}
            placeholder={t('compiti.assegna.selectStudente')}
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
      </div>
    </Modal>
  );
};

export default AssegnaModal;
