import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useRendiDisponibile, useRevocaDisponibilita } from '../../../hooks/useCorsi';
import { useAuleList } from '../../../hooks/useAule';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import styles from './Corsi.module.css';

/**
 * Gestione della disponibilità del corso presso le aule (staff).
 *
 * L'isolamento tra scuole è garantito dal backend: rendere un corso disponibile
 * a un'aula di un'altra scuola restituisce 403 (CROSS_SCUOLA_FORBIDDEN), che qui
 * viene mostrato come toast. Per una UX più pulita, quando l'elenco aule espone
 * `scuolaId` filtriamo già le aule della stessa scuola del corso.
 */
const DisponibilitaPanel = ({ corso }) => {
  const { t } = useTranslation();
  const [classeId, setClasseId] = useState('');
  const rendiDisponibile = useRendiDisponibile();
  const revocaDisponibilita = useRevocaDisponibilita();

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];
  const auleDisponibili = corso.auleDisponibili ?? [];

  const idGiaDisponibili = new Set(auleDisponibili.map((a) => a.classeId));
  const auleSelezionabili = aule.filter((a) => {
    if (idGiaDisponibili.has(a.id)) return false;
    // Se il dato è disponibile, limita alle aule della stessa scuola del corso.
    if (a.scuolaId && corso.scuolaId && a.scuolaId !== corso.scuolaId) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!classeId) return;
    try {
      await rendiDisponibile.mutateAsync({ id: corso.id, classeId });
      toast.success(t('corsi.disponibilita.added'));
      setClasseId('');
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const handleRemove = async (aulaId) => {
    if (!window.confirm(t('corsi.disponibilita.removeConfirm'))) return;
    try {
      await revocaDisponibilita.mutateAsync({ id: corso.id, classeId: aulaId });
      toast.success(t('corsi.disponibilita.removed'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('corsi.disponibilita.title')}</h3>
      </div>

      {auleDisponibili.length === 0 ? (
        <p className={styles.emptyText}>{t('corsi.disponibilita.empty')}</p>
      ) : (
        <ul className={styles.aulaList}>
          {auleDisponibili.map((aula) => (
            <li key={aula.classeId} className={styles.aulaRow}>
              <span className={styles.aulaInfo}>
                <span className={styles.aulaName}>{aula.nome}</span>
                {aula.livello && <Badge tone="neutral">{aula.livello}</Badge>}
                {aula.annoScolastico && (
                  <span className={styles.mutedSmall}>{aula.annoScolastico}</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(aula.classeId)}
                isLoading={
                  revocaDisponibilita.isPending &&
                  revocaDisponibilita.variables?.classeId === aula.classeId
                }
              >
                {t('corsi.disponibilita.revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <Select
          label={t('corsi.disponibilita.aula')}
          placeholder={
            auleSelezionabili.length === 0
              ? t('corsi.disponibilita.noAule')
              : t('corsi.disponibilita.selectAula')
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
        <Button
          onClick={handleAdd}
          disabled={!classeId}
          isLoading={rendiDisponibile.isPending}
        >
          {t('corsi.disponibilita.add')}
        </Button>
      </div>
    </Card>
  );
};

export default DisponibilitaPanel;
