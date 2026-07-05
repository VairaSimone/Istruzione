import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifiche } from '../../../hooks/useMessaggi';
import { ROUTES } from '../../../constants/routes';
import styles from './Messaggi.module.css';

/**
 * Link "Messaggi" per la navbar, con badge del numero di messaggi non letti
 * (aggiornato in polling da `useNotifiche`).
 */
const MessaggiNavLink = ({ className }) => {
  const { t } = useTranslation();
  const { data } = useNotifiche();
  const nonLetti = data?.nonLetti ?? 0;

  return (
    <Link to={ROUTES.MESSAGGI} className={className}>
      <span className={styles.navLinkInner}>
        {t('nav.messaggi')}
        {nonLetti > 0 && (
          <span className={styles.notifBadge} aria-label={t('messaggi.unreadAria', { n: nonLetti })}>
            {nonLetti > 99 ? '99+' : nonLetti}
          </span>
        )}
      </span>
    </Link>
  );
};

export default MessaggiNavLink;
