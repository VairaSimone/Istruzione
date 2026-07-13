import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useBloccaScuola, useSbloccaScuola } from '../../../hooks/useScuole';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import EliminaScuolaModal from './EliminaScuolaModal';
import styles from './Scuole.module.css';

/**
 * Riga di una scuola nell'elenco admin: nome, slug pubblico, stato, occupazione
 * quota e azioni (modifica / blocca-sblocca / elimina).
 *
 * - BLOCCA sospende gli accessi a tutti gli utenti (contratto scaduto): i dati
 *   restano intatti ed è reversibile con SBLOCCA.
 * - ELIMINA è definitiva: cancella la scuola e TUTTI i suoi dati; richiede di
 *   digitare il nome della scuola (modale dedicato).
 *
 * Lo SLUG è mostrato perché è ciò che si incolla in `?scuola=…`: senza vederlo,
 * l'admin dovrebbe indovinarlo.
 */
const ScuolaRow = ({ scuola, onEdit }) => {
  const { t } = useTranslation();
  const bloccaScuola = useBloccaScuola();
  const sbloccaScuola = useSbloccaScuola();
  const [confirmBloccoOpen, setConfirmBloccoOpen] = useState(false);
  const [eliminaOpen, setEliminaOpen] = useState(false);

  const utenti = scuola.conteggio?.utenti ?? 0;
  const aule = scuola.conteggio?.aule ?? 0;
  const quota = scuola.quota ?? null;
  const attiva = scuola.attiva !== false;

  // Formatta un valore in GB compatto (fino a 1-2 decimali, senza zeri finali).
  const fmtGb = (gb) => {
    if (gb === null || gb === undefined) return '0';
    const n = Number(gb);
    if (!Number.isFinite(n)) return '0';
    if (n === 0) return '0';
    return n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, '');
  };
  // Tono del badge in base alla percentuale d'uso (rosso oltre il 95%).
  const tono = (perc) => (perc !== null && perc !== undefined && perc >= 95 ? 'danger' : 'neutral');

  const handleBlocca = async () => {
    try {
      await bloccaScuola.mutateAsync(scuola.id);
      toast.success(t('scuole.toast.blocked'));
      setConfirmBloccoOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
      setConfirmBloccoOpen(false);
    }
  };

  const handleSblocca = async () => {
    try {
      await sbloccaScuola.mutateAsync(scuola.id);
      toast.success(t('scuole.toast.unblocked'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <>
      <div className={styles.item}>
        <div className={styles.itemMain}>
          <span className={styles.itemName}>{scuola.nome}</span>
          {scuola.slug && <span className={styles.itemSlug}>/{scuola.slug}</span>}
          <span className={styles.itemMeta}>
            <span className={styles.itemBadges}>
              {scuola.predefinita && (
                <Badge tone="gold">{t('scuole.list.predefinita')}</Badge>
              )}
              {scuola.attiva === false && (
                <Badge tone="seal">{t('scuole.list.sospesa')}</Badge>
              )}

              {/* Utenti: mostra "usati / limite" se c'è un limite, altrimenti solo il conteggio. */}
              {quota && !quota.utenti.illimitato ? (
                <Badge tone={tono(quota.utenti.percentuale)}>
                  {t('scuole.list.utentiQuota', {
                    usati: quota.utenti.occupati,
                    limite: quota.utenti.limite,
                  })}
                </Badge>
              ) : (
                <Badge tone="neutral">{t('scuole.list.utentiCount', { count: utenti })}</Badge>
              )}

              {/* Insegnanti: solo se è impostato un sotto-limite. */}
              {quota && !quota.insegnanti.illimitato && (
                <Badge tone={tono(quota.insegnanti.percentuale)}>
                  {t('scuole.list.insegnantiQuota', {
                    usati: quota.insegnanti.occupati,
                    limite: quota.insegnanti.limite,
                  })}
                </Badge>
              )}

              {/* Storage: "usato / limite GB" oppure solo l'usato se illimitato. */}
              {quota && (
                <Badge tone={quota.storage.illimitato ? 'neutral' : tono(quota.storage.percentuale)}>
                  {quota.storage.illimitato
                    ? t('scuole.list.storageIllimitato', { usato: fmtGb(quota.storage.usatoGb) })
                    : t('scuole.list.storageQuota', {
                        usato: fmtGb(quota.storage.usatoGb),
                        limite: fmtGb(quota.storage.limiteGb),
                      })}
                </Badge>
              )}

              <Badge tone="neutral">{t('scuole.list.auleCount', { count: aule })}</Badge>
            </span>
          </span>
        </div>
        <div className={styles.itemActions}>
          <Button variant="secondary" size="sm" onClick={() => onEdit(scuola)}>
            {t('common.edit')}
          </Button>
          {attiva ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmBloccoOpen(true)}
              isLoading={bloccaScuola.isPending}
            >
              {t('scuole.actions.blocca')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSblocca}
              isLoading={sbloccaScuola.isPending}
            >
              {t('scuole.actions.sblocca')}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setEliminaOpen(true)}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {/* Conferma blocco: reversibile, quindi conferma leggera. */}
      <ConfirmDialog
        isOpen={confirmBloccoOpen}
        title={t('scuole.blocca.title')}
        description={t('scuole.blocca.description', { nome: scuola.nome })}
        confirmLabel={t('scuole.actions.blocca')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        isLoading={bloccaScuola.isPending}
        onConfirm={handleBlocca}
        onCancel={() => setConfirmBloccoOpen(false)}
      />

      {/* Eliminazione definitiva: conferma forte (digitazione del nome).
          Montato solo quando aperto → stato del campo pulito a ogni apertura. */}
      {eliminaOpen && (
        <EliminaScuolaModal
          isOpen
          onClose={() => setEliminaOpen(false)}
          scuola={scuola}
        />
      )}
    </>
  );
};

export default ScuolaRow;
