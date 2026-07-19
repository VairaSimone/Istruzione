import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatNotifiche } from '../../../hooks/useChat';
import { ROUTES } from '../../../constants/routes';
import styles from './Chat.module.css';

/**
 * Link "Chat" per la navbar, con badge del numero di messaggi non letti su
 * tutte le aule dell'utente (aggiornato in polling da `useChatNotifiche`).
 */
const ChatNavLink = ({ className }) => {
  const { t } = useTranslation();
  const { data } = useChatNotifiche();
  const nonLetti = data?.nonLetti ?? 0;

  return (
    <Link to={ROUTES.CHAT} className={className}>
      <span className={styles.navLinkInner}>
        {t('nav.chat')}
        {nonLetti > 0 && (
          <span className={styles.notifBadge} aria-label={t('chat.unreadAria', { n: nonLetti })}>
            {nonLetti > 99 ? '99+' : nonLetti}
          </span>
        )}
      </span>
    </Link>
  );
};

export default ChatNavLink;
