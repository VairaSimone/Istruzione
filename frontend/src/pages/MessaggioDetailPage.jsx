import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useMessaggio, useEliminaMessaggio } from '../hooks/useMessaggi';
import { useAuthStore, selectIsAdmin } from '../store/authStore';
import { queryKeys } from '../constants/queryKeys';
import { ROUTES } from '../constants/routes';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { formatDateTime } from '../utils/datetime';
import { TIPO_MESSAGGIO_TONE } from '../features/messaggi/tipoTone';
import RispostaForm from '../features/messaggi/components/RispostaForm';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/messaggi/components/Messaggi.module.css';

/**
 * Dettaglio di un messaggio: intestazione, corpo, thread delle risposte e
 * form di risposta (se consentito e se l'utente è un destinatario).
 *
 * L'apertura marca il messaggio come letto lato server (GET /:id): al
 * caricamento invalidiamo il contatore notifiche per aggiornare il badge.
 */
const MessaggioDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore(selectIsAdmin);

  const { data: messaggio, isLoading, isError } = useMessaggio(id);
  const elimina = useEliminaMessaggio();

  useEffect(() => {
    if (messaggio) {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaggi.notifiche });
    }
  }, [messaggio, queryClient]);

  const handleDelete = async () => {
    if (!window.confirm(t('messaggi.detail.deleteConfirm'))) return;
    try {
      await elimina.mutateAsync(id);
      toast.success(t('messaggi.detail.deleted'));
      navigate(ROUTES.MESSAGGI);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError || !messaggio)
    return <p className={styles.emptyText}>{t('messaggi.detail.loadError')}</p>;

  const eAutore = user?.id === messaggio.mittenteId;
  const eDestinatario = messaggio.letto === true;
  const puoRispondere = messaggio.consentiRisposte && eDestinatario;
  const puoEliminare = eAutore || isAdmin;
  const risposte = messaggio.risposte ?? [];

  const nomeMittente = messaggio.mittente
    ? `${messaggio.mittente.nome} ${messaggio.mittente.cognome}`
    : t('messaggi.detail.unknownSender');

  return (
    <div>
      <Link to={ROUTES.MESSAGGI} className={styles.backLink}>
        ← {t('messaggi.detail.back')}
      </Link>

      <Card>
        <div className={styles.detailHead}>
          <h1 className={styles.detailSubject}>
            {messaggio.oggetto || t('messaggi.noSubject')}
          </h1>
          <div className={styles.toggle}>
            <Badge tone={TIPO_MESSAGGIO_TONE[messaggio.tipo] || 'neutral'}>
              {t(`messaggi.tipi.${messaggio.tipo}`)}
            </Badge>
            {puoEliminare && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                isLoading={elimina.isPending}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
        <div className={styles.detailMeta}>
          <span>{t('messaggi.from', { nome: nomeMittente })}</span>
          <span>{formatDateTime(messaggio.created_at, i18n.language)}</span>
        </div>
        <p className={styles.body}>{messaggio.corpo}</p>
      </Card>

      {risposte.length > 0 && (
        <div className={styles.thread}>
          <h2 className={styles.threadTitle}>
            {t('messaggi.detail.thread', { n: risposte.length })}
          </h2>
          {risposte.map((r) => (
            <Card key={r.id} className={styles.reply}>
              <div className={styles.replyMeta}>
                {r.mittente
                  ? `${r.mittente.nome} ${r.mittente.cognome}`
                  : t('messaggi.detail.unknownSender')}{' '}
                · {formatDateTime(r.created_at, i18n.language)}
              </div>
              <p className={styles.body}>{r.corpo}</p>
            </Card>
          ))}
        </div>
      )}

      {puoRispondere && (
        <div className={styles.thread}>
          <RispostaForm messaggioId={messaggio.id} />
        </div>
      )}
    </div>
  );
};

export default MessaggioDetailPage;
