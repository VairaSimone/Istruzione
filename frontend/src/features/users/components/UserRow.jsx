import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import {
  useUpdateUserRole,
  useDeleteUserByTeacher,
} from '../../../hooks/useUserManagementMutations';
import { parseApiError } from '../../../utils/parseApiError';
import { ROLE_OPTIONS } from '../../../constants/domain';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './UserRow.module.css';

const UserRow = ({ utente }) => {
  const currentUser = useAuthStore((state) => state.user);
  const updateRoleMutation = useUpdateUserRole();
  const deleteUserMutation = useDeleteUserByTeacher();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // NOTA UX (non imposta dal backend): il backend non impedisce a un
  // insegnante di cambiare il proprio ruolo o di auto-eliminarsi tramite
  // questi stessi endpoint. Disabilitiamo queste azioni sulla propria riga
  // lato client per prevenire blocchi accidentali (es. un insegnante che si
  // declassa a studente perdendo l'accesso alla pagina che sta usando).
  const isSelf = currentUser?.id === utente.id;

  const handleRoleChange = async (event) => {
    const nuovoRuolo = event.target.value;
    if (nuovoRuolo === utente.ruolo) return;

    try {
      await updateRoleMutation.mutateAsync({ id: utente.id, ruolo: nuovoRuolo });
      toast.success(`Ruolo di ${utente.nome} aggiornato a "${nuovoRuolo}".`);
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUserMutation.mutateAsync(utente.id);
      toast.success(`Account di ${utente.nome} ${utente.cognome} eliminato.`);
      setIsConfirmingDelete(false);
    } catch (error) {
      toast.error(parseApiError(error).message);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <>
      <tr className={styles.row}>
        <td>
          <div className={styles.nameCell}>
            <span className={styles.fullName}>
              {utente.nome} {utente.cognome}
            </span>
            <span className={styles.email}>{utente.email}</span>
          </div>
        </td>
        <td>{utente.classe}</td>
        <td>
          <Badge tone={utente.email_verificata ? 'matcha' : 'danger'}>
            {utente.email_verificata ? 'Verificata' : 'Non verificata'}
          </Badge>
        </td>
        <td>
          <select
            className={styles.roleSelect}
            value={utente.ruolo}
            onChange={handleRoleChange}
            disabled={updateRoleMutation.isPending || isSelf}
            aria-label={`Ruolo di ${utente.nome} ${utente.cognome}`}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </td>
        <td className={styles.actionsCell}>
          <Button
            variant="danger"
            size="sm"
            disabled={isSelf}
            onClick={() => setIsConfirmingDelete(true)}
          >
            Elimina
          </Button>
        </td>
      </tr>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="Eliminare questo account?"
        description={`L'account di ${utente.nome} ${utente.cognome} (${utente.email}) verrà eliminato definitivamente. L'operazione non può essere annullata.`}
        confirmLabel="Elimina definitivamente"
        isLoading={deleteUserMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </>
  );
};

export default UserRow;
