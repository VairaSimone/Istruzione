import { memo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import {
  useUpdateUserRole,
  useDeleteUserByTeacher,
} from '../../../hooks/useUserManagementMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { ROLE_OPTIONS, ROLES, ACCOUNT_STATES } from '../../../constants/domain';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './UserRow.module.css';
import { etichettaClasse } from '../../../utils/classe';

const STATE_TONE = {
  [ACCOUNT_STATES.ATTIVO]: 'matcha',
  [ACCOUNT_STATES.IN_ATTESA]: 'gold',
  [ACCOUNT_STATES.RIFIUTATO]: 'danger',
};

const UserRow = ({ utente }) => {
  const { t } = useTranslation();
  const currentUser = useAuthStore((state) => state.user);
  const updateRoleMutation = useUpdateUserRole();
  const deleteUserMutation = useDeleteUserByTeacher();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isSelf = currentUser?.id === utente.id;
  // Il ruolo admin non è assegnabile dalla dropdown (operazione riservata):
  // gli account admin sono mostrati come badge in sola lettura.
  const isAdminRow = utente.ruolo === ROLES.ADMIN;
  const fullName = `${utente.nome} ${utente.cognome}`;

  const handleRoleChange = async (event) => {
    const nuovoRuolo = event.target.value;
    if (nuovoRuolo === utente.ruolo) return;

    try {
      await updateRoleMutation.mutateAsync({ id: utente.id, ruolo: nuovoRuolo });
      toast.success(
        t('users.row.roleUpdated', {
          name: utente.nome,
          role: t(`roles.${nuovoRuolo}`),
        })
      );
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUserMutation.mutateAsync(utente.id);
      toast.success(t('users.row.deleted', { name: fullName }));
      setIsConfirmingDelete(false);
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
      setIsConfirmingDelete(false);
    }
  };

  return (
    <>
      <tr className={styles.row}>
        <td>
          <div className={styles.nameCell}>
            <span className={styles.fullName}>{fullName}</span>
            <span className={styles.email}>{utente.email}</span>
          </div>
        </td>
        <td>{etichettaClasse(t, utente.classe, '—')}</td>
        <td>
          <div className={styles.statusCell}>
            <Badge tone={utente.email_verificata ? 'matcha' : 'danger'}>
              {utente.email_verificata
                ? t('profile.verified')
                : t('profile.notVerified')}
            </Badge>
            {utente.stato && utente.stato !== ACCOUNT_STATES.ATTIVO && (
              <Badge tone={STATE_TONE[utente.stato] ?? 'neutral'}>
                {t(`stati.${utente.stato}`)}
              </Badge>
            )}
          </div>
        </td>
        <td>
          {isAdminRow ? (
            <Badge tone="gold">{t('roles.admin')}</Badge>
          ) : (
            <select
              className={styles.roleSelect}
              value={utente.ruolo}
              onChange={handleRoleChange}
              disabled={updateRoleMutation.isPending || isSelf}
              aria-label={t('users.row.roleAria', { name: fullName })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className={styles.actionsCell}>
          <Button
            variant="danger"
            size="sm"
            disabled={isSelf || isAdminRow}
            onClick={() => setIsConfirmingDelete(true)}
          >
            {t('users.row.delete')}
          </Button>
        </td>
      </tr>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={t('users.row.confirmTitle')}
        description={t('users.row.confirmDescription', {
          name: fullName,
          email: utente.email,
        })}
        confirmLabel={t('users.row.confirmCta')}
        isLoading={deleteUserMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </>
  );
};

// React.memo: la riga è ripetuta molte volte nella tabella utenti. Memoizzarla
// evita di ri-renderizzare tutte le righe quando il componente padre si
// aggiorna per motivi estranei alla singola riga (es. il toggle di isFetching
// della paginazione). Applicato SOLO qui, dove la ripetizione lo giustifica.
export default memo(UserRow);
