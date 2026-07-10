import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useRevokeInvite } from '../../../hooks/useInvites';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { INVITE_STATES, INVITE_ROLES } from '../../../constants/domain';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './Invites.module.css';

const STATE_TONE = {
  [INVITE_STATES.PENDENTE]: 'gold',
  [INVITE_STATES.COMPLETATO]: 'matcha',
  [INVITE_STATES.REVOCATO]: 'neutral',
};

const InviteRow = ({ invito }) => {
  const { t, i18n } = useTranslation();
  const revokeMutation = useRevokeInvite();
  const [isConfirming, setIsConfirming] = useState(false);

  const isPending = invito.stato === INVITE_STATES.PENDENTE;
  const scadenza = invito.scadenza
    ? new Date(invito.scadenza).toLocaleDateString(i18n.language)
    : '—';

  const handleRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(invito.id);
      toast.success(t('invites.list.revoked', { email: invito.email }));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <>
      <div className={styles.item}>
        <div className={styles.itemMain}>
          <span className={styles.itemEmail}>{invito.email}</span>
          <div className={styles.itemMeta}>
            <Badge tone={invito.ruolo === INVITE_ROLES.INSEGNANTE ? 'gold' : 'seal'}>
              {t(`roles.${invito.ruolo}`)}
            </Badge>
            {invito.classe && <Badge tone="neutral">{invito.classe}</Badge>}
            <Badge tone={STATE_TONE[invito.stato] ?? 'neutral'}>
              {t(`invites.status.${invito.stato}`)}
            </Badge>
            <span>{t('invites.list.expires', { date: scadenza })}</span>
          </div>
        </div>
        <div className={styles.itemActions}>
          {isPending && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsConfirming(true)}
              isLoading={revokeMutation.isPending}
            >
              {t('invites.list.revoke')}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirming}
        title={t('invites.list.confirmTitle')}
        description={t('invites.list.confirmDescription', { email: invito.email })}
        confirmLabel={t('invites.list.revoke')}
        isLoading={revokeMutation.isPending}
        onConfirm={handleRevoke}
        onCancel={() => setIsConfirming(false)}
      />
    </>
  );
};

export default InviteRow;
