import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDeleteMyAccount } from '../../../hooks/useProfileMutations';
import { parseApiError } from '../../../utils/parseApiError';
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
  const navigate = useNavigate();
  const deleteMutation = useDeleteMyAccount();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync();
      toast.success('Il tuo account è stato eliminato.');
      navigate(ROUTES.HOME, { replace: true });
    } catch (error) {
      toast.error(parseApiError(error).message);
      setIsConfirming(false);
    }
  };

  return (
    <Card className={styles.dangerZone}>
      <h2 className={styles.sectionTitle}>Elimina account</h2>
      <p className={styles.sectionDescription}>
        Questa azione è permanente. Tutti i tuoi dati verranno eliminati definitivamente e
        non potranno essere recuperati.
      </p>

      {isConfirming ? (
        <>
          <p className={styles.confirmText}>
            Sei sicuro? Questa operazione non può essere annullata.
          </p>
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Sì, elimina definitivamente
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsConfirming(false)}
              disabled={deleteMutation.isPending}
            >
              Annulla
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.dangerActions}>
          <Button variant="danger" onClick={() => setIsConfirming(true)}>
            Elimina il mio account
          </Button>
        </div>
      )}
    </Card>
  );
};

export default DeleteAccountSection;
