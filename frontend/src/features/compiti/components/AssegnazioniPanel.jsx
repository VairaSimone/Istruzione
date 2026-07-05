import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useRemoveAssegnazione } from '../../../hooks/useCompiti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import AssegnaModal from './AssegnaModal';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import styles from './Compiti.module.css';

/** Elenca i destinatari (aule/studenti) del compito, con aggiunta e rimozione. */
const AssegnazioniPanel = ({ compito }) => {
  const { t } = useTranslation();
  const removeAssegnazione = useRemoveAssegnazione();
  const [isModalOpen, setModalOpen] = useState(false);
  const assegnazioni = compito.assegnazioni ?? [];

  const handleRemove = async (assegnazioneId) => {
    try {
      await removeAssegnazione.mutateAsync({ id: compito.id, assegnazioneId });
      toast.success(t('compiti.toast.unassigned'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('compiti.detail.assignmentsTitle')}</h3>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          {t('compiti.detail.assign')}
        </Button>
      </div>

      {assegnazioni.length === 0 ? (
        <p className={styles.emptyText}>{t('compiti.detail.noAssignments')}</p>
      ) : (
        <ul className={styles.memberList}>
          {assegnazioni.map((a) => (
            <li key={a.id} className={styles.memberRow}>
              <div className={styles.assegnInfo}>
                <Badge tone={a.tipo === 'classe' ? 'matcha' : 'gold'}>
                  {t(`compiti.detail.type_${a.tipo}`)}
                </Badge>
                <span className={styles.memberName}>
                  {a.tipo === 'classe'
                    ? a.classe?.nome
                    : `${a.studente?.nome ?? ''} ${a.studente?.cognome ?? ''}`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(a.id)}
                isLoading={removeAssegnazione.isPending}
              >
                {t('common.remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AssegnaModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        compitoId={compito.id}
      />
    </Card>
  );
};

export default AssegnazioniPanel;
