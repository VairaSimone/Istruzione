import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useDeleteMyAccount } from '../../../hooks/useProfileMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { ROUTES } from '../../../constants/routes';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './ProfileSections.module.css';

/**
 * Eliminazione account: azione distruttiva e irreversibile
 * (DELETE /me -> utente.destroy(), nessun soft-delete nel backend).
 * Richiede una conferma esplicita a due passaggi prima di inviare la
 * richiesta, per prevenire eliminazioni accidentali da un singolo click.
 */
const DeleteAccountSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteMutation = useDeleteMyAccount();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync();
      toast.success(t('profile.deleteSuccess'));
      navigate(ROUTES.HOME, { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
      setIsConfirming(false);
    }
  };

  return (
    <Card className={styles.dangerZone}>
      <h2 className={styles.sectionTitle}>{t('profile.deleteTitle')}</h2>
      <p className={styles.sectionDescription}>{t('profile.deleteDescription')}</p>

      {isConfirming ? (
        <>
          <p className={styles.confirmText}>{t('profile.deleteConfirmText')}</p>
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              {t('profile.deleteConfirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsConfirming(false)}
              disabled={deleteMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.dangerActions}>
          <Button variant="danger" onClick={() => setIsConfirming(true)}>
            {t('profile.deleteCta')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default DeleteAccountSection;
