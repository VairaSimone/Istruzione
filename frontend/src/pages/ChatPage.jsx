import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Spinner from '../components/ui/Spinner';
import ErrorState from '../components/shared/ErrorState';
import EmptyState from '../components/shared/EmptyState';
import { useChatAule, useSegnaLettoChat } from '../hooks/useChat';
import { ROUTES, chatAulaPath } from '../constants/routes';
import ChatAuleList from '../features/chat/components/ChatAuleList';
import ChatFinestra from '../features/chat/components/ChatFinestra';
import styles from '../features/chat/components/Chat.module.css';

/**
 * Pagina della CHAT D'AULA.
 *
 * Un'unica vista a due colonne: a sinistra le aule di cui l'utente è membro, a
 * destra il feed dell'aula selezionata (`/chat/:classeId`). Su schermi stretti
 * si mostra una colonna alla volta, con ritorno all'elenco dal pulsante
 * "indietro". Aprendo un'aula la si segna come letta (badge azzerati).
 */
const ChatPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { classeId } = useParams();

  const { data: aule, isLoading, isError, refetch } = useChatAule();
  const segnaLetto = useSegnaLettoChat();

  // Aprendo un'aula la si segna come letta (il GET del feed la marca comunque
  // lato server; qui garantiamo l'aggiornamento immediato di badge e notifiche).
  useEffect(() => {
    if (classeId) segnaLetto.mutate(classeId);
    // Volutamente solo su `classeId`: una sola marcatura per apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  const seleziona = (id) => navigate(chatAulaPath(id));
  const tornaAlleAule = () => navigate(ROUTES.CHAT);

  const aulaSelezionata = (aule ?? []).find((a) => String(a.id) === String(classeId)) || null;

  if (isLoading) {
    return (
      <div>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>{t('chat.title')}</h1>
          <p className={styles.pageSubtitle}>{t('chat.subtitle')}</p>
        </header>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>{t('chat.title')}</h1>
        </header>
        <ErrorState message={t('chat.erroreAule')} onRetry={refetch} />
      </div>
    );
  }

  const nessunAula = !aule || aule.length === 0;

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('chat.title')}</h1>
        <p className={styles.pageSubtitle}>{t('chat.subtitle')}</p>
      </header>

      {nessunAula ? (
        <EmptyState
          title={t('chat.nessunAula.title')}
          description={t('chat.nessunAula.descrizione')}
        />
      ) : (
        <div
          className={[
            styles.layout,
            classeId ? styles.layoutConSelezione : styles.layoutSenzaSelezione,
          ].join(' ')}
        >
          <ChatAuleList
            aule={aule}
            classeSelezionata={classeId}
            onSeleziona={seleziona}
          />

          {classeId ? (
            <ChatFinestra
              key={classeId}
              classeId={classeId}
              ruoloNellaClasse={aulaSelezionata?.ruoloNellaClasse}
              onBack={tornaAlleAule}
            />
          ) : (
            <div className={styles.main}>
              <div className={styles.placeholder}>{t('chat.selezionaAula')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatPage;
