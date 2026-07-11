import { useTranslation } from 'react-i18next';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import VoceChip from './VoceChip';
import styles from './Calendario.module.css';

/**
 * Elenco delle voci di un singolo giorno (aperto cliccando su una cella del
 * calendario). Da qui si apre il dettaglio di una voce oppure — per chi può
 * gestire — si crea un nuovo evento già datato a quel giorno.
 */
const GiornoEventiModal = ({
  isOpen,
  onClose,
  giorno,
  voci = [],
  onSelezionaVoce,
  onNuovoEvento,
  puoCreare = false,
}) => {
  const { t, i18n } = useTranslation();

  const titolo = giorno
    ? new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(giorno)
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titolo}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
          {puoCreare && (
            <Button onClick={() => onNuovoEvento(giorno)}>{t('calendario.list.create')}</Button>
          )}
        </>
      }
    >
      {voci.length === 0 ? (
        <p className={styles.emptyText}>{t('calendario.giorno.empty')}</p>
      ) : (
        <div className={styles.dayModalList}>
          {voci.map((voce) => (
            <VoceChip
              key={`${voce.tipoVoce}-${voce.id}`}
              voce={voce}
              onClick={() => onSelezionaVoce(voce)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
};

export default GiornoEventiModal;
