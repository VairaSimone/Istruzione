import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAbilitaPerAula, useDisabilitaPerAula } from '../../../hooks/useQuizGestione';
import { useAuleList } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import styles from './QuizGestione.module.css';

/**
 * Abilitazione del quiz presso le aule (staff).
 *
 * Il backend garantisce i vincoli: quiz e aula devono appartenere alla stessa
 * scuola (`CROSS_SCUOLA_FORBIDDEN`) e l'insegnante deve insegnare nell'aula
 * (`FORBIDDEN`). Qui filtriamo già le aule della scuola del quiz, quando il
 * dato è disponibile, per una scelta più pulita.
 *
 * Uno studente vede il quiz solo se è PUBBLICATO e abilitato per una sua aula:
 * abilitarlo mentre è in bozza non lo espone.
 */
const QuizAulePanel = ({ quiz }) => {
  const { t } = useTranslation();
  const [classeId, setClasseId] = useState('');
  const abilita = useAbilitaPerAula();
  const disabilita = useDisabilitaPerAula();

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];
  const auleAbilitate = quiz.auleAbilitate ?? [];

  const idGiaAbilitate = new Set(auleAbilitate.map((a) => a.classeId));
  const auleSelezionabili = aule.filter((a) => {
    if (idGiaAbilitate.has(a.id)) return false;
    if (a.scuolaId && quiz.scuolaId && a.scuolaId !== quiz.scuolaId) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!classeId) return;
    try {
      await abilita.mutateAsync({ id: quiz.id, classeId });
      toast.success(t('quizGestione.aule.added'));
      setClasseId('');
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const handleRemove = async (aulaId) => {
    if (!window.confirm(t('quizGestione.aule.removeConfirm'))) return;
    try {
      await disabilita.mutateAsync({ id: quiz.id, classeId: aulaId });
      toast.success(t('quizGestione.aule.removed'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>{t('quizGestione.aule.title')}</h3>
          {quiz.stato !== 'pubblicato' && (
            <p className={styles.mutedSmall}>{t('quizGestione.aule.nonPubblicato')}</p>
          )}
        </div>
      </div>

      {auleAbilitate.length === 0 ? (
        <p className={styles.emptyText}>{t('quizGestione.aule.empty')}</p>
      ) : (
        <ul className={styles.aulaList}>
          {auleAbilitate.map((aula) => (
            <li key={aula.classeId} className={styles.aulaRow}>
              <span className={styles.aulaInfo}>
                <span className={styles.aulaName}>{aula.nome}</span>
                {aula.livelloJLPT && <Badge tone="neutral">{aula.livelloJLPT}</Badge>}
                {aula.annoScolastico && (
                  <span className={styles.mutedSmall}>{aula.annoScolastico}</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(aula.classeId)}
                isLoading={
                  disabilita.isPending && disabilita.variables?.classeId === aula.classeId
                }
              >
                {t('quizGestione.aule.revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <Select
          label={t('quizGestione.aule.aula')}
          placeholder={
            auleSelezionabili.length === 0
              ? t('quizGestione.aule.noAule')
              : t('quizGestione.aule.selectAula')
          }
          value={classeId}
          disabled={auleSelezionabili.length === 0}
          onChange={(e) => setClasseId(e.target.value)}
        >
          {auleSelezionabili.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>
        <Button onClick={handleAdd} disabled={!classeId} isLoading={abilita.isPending}>
          {t('quizGestione.aule.add')}
        </Button>
      </div>
    </Card>
  );
};

export default QuizAulePanel;
