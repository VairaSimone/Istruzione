import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  useEsportaDati,
  useRichiediCancellazione,
  useAnnullaCancellazione,
} from '../../../hooks/useProfileMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useAuthStore } from '../../../store/authStore';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './ProfileSections.module.css';

/**
 * Sezione "I tuoi dati" (diritti dell'interessato, GDPR):
 *  - ESPORTAZIONE dati personali in JSON (art. 20 — portabilità);
 *  - RICHIESTA DI CANCELLAZIONE con periodo di grazia (art. 17): non elimina
 *    subito, ma programma l'eliminazione definitiva. Finché è pendente l'utente
 *    può annullarla. È distinta dall'eliminazione immediata (DeleteAccountSection).
 */
const DatiPersonaliSection = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const esportaMutation = useEsportaDati();
  const richiediMutation = useRichiediCancellazione();
  const annullaMutation = useAnnullaCancellazione();

  const [isConfirming, setIsConfirming] = useState(false);

  const cancellazionePendente = Boolean(user?.cancellazione_richiesta_at);

  const handleEsporta = async () => {
    try {
      await esportaMutation.mutateAsync();
      toast.success(t('profile.dati.exportSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
    }
  };

  const handleRichiedi = async () => {
    try {
      await richiediMutation.mutateAsync();
      toast.success(t('profile.dati.deleteRequested'));
      setIsConfirming(false);
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
      setIsConfirming(false);
    }
  };

  const handleAnnulla = async () => {
    try {
      await annullaMutation.mutateAsync();
      toast.success(t('profile.dati.deleteCancelled'));
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>{t('profile.dati.title')}</h2>
      <p className={styles.sectionDescription}>{t('profile.dati.description')}</p>

      {/* Esportazione dati */}
      <div className={styles.dangerActions}>
        <Button
          variant="secondary"
          onClick={handleEsporta}
          isLoading={esportaMutation.isPending}
        >
          {t('profile.dati.exportCta')}
        </Button>
      </div>

      {/* Richiesta di cancellazione con periodo di grazia */}
      {cancellazionePendente ? (
        <>
          <p className={styles.confirmText}>{t('profile.dati.pendingText')}</p>
          <div className={styles.dangerActions}>
            <Button
              variant="primary"
              onClick={handleAnnulla}
              isLoading={annullaMutation.isPending}
            >
              {t('profile.dati.cancelDeleteCta')}
            </Button>
          </div>
        </>
      ) : isConfirming ? (
        <>
          <p className={styles.confirmText}>{t('profile.dati.deleteConfirmText')}</p>
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              onClick={handleRichiedi}
              isLoading={richiediMutation.isPending}
            >
              {t('profile.dati.deleteConfirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsConfirming(false)}
              disabled={richiediMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.dangerActions}>
          <Button variant="danger" onClick={() => setIsConfirming(true)}>
            {t('profile.dati.deleteRequestCta')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default DatiPersonaliSection;
