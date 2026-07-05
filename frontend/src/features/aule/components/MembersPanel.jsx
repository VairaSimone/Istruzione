import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useRemoveStudent, useRemoveTeacher } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './Aule.module.css';

/**
 * Elenca i membri dell'aula divisi per ruolo, con azione di rimozione.
 * Il backend impedisce di rimuovere l'ultimo insegnante (errore LAST_TEACHER).
 */
const MembersPanel = ({ aula }) => {
  const { t } = useTranslation();
  const removeStudent = useRemoveStudent();
  const removeTeacher = useRemoveTeacher();

  const handleRemoveStudent = async (utenteId) => {
    try {
      await removeStudent.mutateAsync({ id: aula.id, utenteId });
      toast.success(t('aule.toast.studentRemoved'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const handleRemoveTeacher = async (utenteId) => {
    try {
      await removeTeacher.mutateAsync({ id: aula.id, utenteId });
      toast.success(t('aule.toast.teacherRemoved'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const renderMember = (membro, onRemove, pending) => (
    <li key={membro.id} className={styles.memberRow}>
      <div>
        <span className={styles.memberName}>
          {membro.nome} {membro.cognome}
        </span>
        <span className={styles.memberEmail}>{membro.email}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(membro.id)}
        isLoading={pending}
      >
        {t('common.remove')}
      </Button>
    </li>
  );

  return (
    <div className={styles.panels}>
      <Card>
        <h3 className={styles.panelTitle}>
          {t('aule.detail.teachers')} ({aula.insegnanti?.length ?? 0})
        </h3>
        {aula.insegnanti?.length ? (
          <ul className={styles.memberList}>
            {aula.insegnanti.map((m) => renderMember(m, handleRemoveTeacher, removeTeacher.isPending))}
          </ul>
        ) : (
          <p className={styles.emptyText}>{t('aule.detail.noTeachers')}</p>
        )}
      </Card>

      <Card>
        <h3 className={styles.panelTitle}>
          {t('aule.detail.students')} ({aula.studenti?.length ?? 0})
        </h3>
        {aula.studenti?.length ? (
          <ul className={styles.memberList}>
            {aula.studenti.map((m) => renderMember(m, handleRemoveStudent, removeStudent.isPending))}
          </ul>
        ) : (
          <p className={styles.emptyText}>{t('aule.detail.noStudents')}</p>
        )}
      </Card>
    </div>
  );
};

export default MembersPanel;
