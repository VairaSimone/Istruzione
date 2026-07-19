import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import Spinner from '../../../components/ui/Spinner';
import Button from '../../../components/ui/Button';
import ErrorState from '../../../components/shared/ErrorState';
import EmptyState from '../../../components/shared/EmptyState';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';

import {
  useChatMessaggi,
  useInviaMessaggioChat,
  useInviaAllegatoChat,
  useEliminaMessaggioChat,
} from '../../../hooks/useChat';
import * as chatService from '../../../services/chatService';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { getActiveLanguage } from '../../../i18n';
import { useAuthStore, selectIsAdmin } from '../../../store/authStore';

import ChatMessaggio from './ChatMessaggio';
import ChatComposer from './ChatComposer';
import styles from './Chat.module.css';

const PAGINA = 50;

/** Chiave di giornata (per i divisori) a partire da un ISO. */
const chiaveGiorno = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const etichettaGiorno = (iso, lang) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const oggi = new Date();
  const ieri = new Date();
  ieri.setDate(oggi.getDate() - 1);
  const stesso = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (stesso(d, oggi)) return 'oggi';
  if (stesso(d, ieri)) return 'ieri';
  return d.toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Finestra della conversazione di un'aula: feed scorrevole (con caricamento dei
 * messaggi precedenti), composer e moderazione. Il feed si aggiorna in polling
 * e all'invio; l'auto-scroll segue i nuovi messaggi ma NON quando si caricano i
 * più vecchi.
 */
const ChatFinestra = ({ classeId, ruoloNellaClasse, onBack }) => {
  const { t } = useTranslation();
  const lang = getActiveLanguage();
  const utente = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore(selectIsAdmin);

  const { data, isLoading, isError, refetch } = useChatMessaggi(classeId, { limit: PAGINA });

  const inviaMessaggio = useInviaMessaggioChat();
  const inviaAllegato = useInviaAllegatoChat();
  const eliminaMessaggio = useEliminaMessaggioChat();

  // Messaggi PRECEDENTI caricati su richiesta (più vecchi della prima pagina).
  // Il componente è montato con `key={classeId}` dal chiamante: al cambio aula
  // viene rimontato, quindi questi stati si azzerano da soli (niente effetti di
  // reset). `haAltriPrecedenti === null` significa «usa il flag del server».
  const [precedenti, setPrecedenti] = useState([]);
  const [haAltriPrecedenti, setHaAltriPrecedenti] = useState(null);
  const [caricandoAltri, setCaricandoAltri] = useState(false);
  const [daEliminare, setDaEliminare] = useState(null);

  const feedRef = useRef(null);
  const fondoRef = useRef(null);

  // Ci sono altri messaggi più vecchi da caricare? Finché non se ne caricano a
  // mano vale il flag del server; poi vale quello dell'ultima pagina caricata.
  const haAltri = haAltriPrecedenti === null ? Boolean(data?.haAltri) : haAltriPrecedenti;

  // Feed completo: precedenti + ultima pagina, deduplicato per id, in ordine
  // cronologico. La prima pagina arriva già ASC dal service.
  const messaggi = useMemo(() => {
    const visti = new Set();
    const uniti = [];
    for (const m of [...precedenti, ...(data?.messaggi ?? [])]) {
      if (visti.has(m.id)) continue;
      visti.add(m.id);
      uniti.push(m);
    }
    return uniti;
  }, [precedenti, data?.messaggi]);

  // Auto-scroll al fondo: al cambio aula e all'arrivo di nuovi messaggi in coda.
  const ultimoId = data?.messaggi?.length ? data.messaggi[data.messaggi.length - 1].id : null;
  useEffect(() => {
    fondoRef.current?.scrollIntoView({ block: 'end' });
  }, [ultimoId, classeId]);

  const caricaAltri = useCallback(async () => {
    if (!messaggi.length || caricandoAltri) return;
    setCaricandoAltri(true);
    const contenitore = feedRef.current;
    const altezzaPrima = contenitore ? contenitore.scrollHeight : 0;
    try {
      const risposta = await chatService.getMessaggi({
        classeId,
        primaDi: messaggi[0].created_at,
        limit: PAGINA,
      });
      setPrecedenti((prec) => {
        const visti = new Set([...prec, ...(data?.messaggi ?? [])].map((m) => m.id));
        const nuovi = (risposta.messaggi ?? []).filter((m) => !visti.has(m.id));
        return [...nuovi, ...prec];
      });
      setHaAltriPrecedenti(Boolean(risposta.haAltri));
      // Mantiene la posizione di lettura dopo il prepend.
      requestAnimationFrame(() => {
        if (contenitore) {
          contenitore.scrollTop = contenitore.scrollHeight - altezzaPrima;
        }
      });
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setCaricandoAltri(false);
    }
  }, [classeId, messaggi, caricandoAltri, data?.messaggi, t]);

  const handleInvia = useCallback(
    async ({ corpo, file, tipo }) => {
      try {
        if (file) {
          await inviaAllegato.mutateAsync({ classeId, tipo, corpo, file });
        } else {
          await inviaMessaggio.mutateAsync({ classeId, corpo });
        }
      } catch (err) {
        toast.error(getApiErrorMessage(t, err));
        throw err; // il composer conserva il testo
      }
    },
    [classeId, inviaAllegato, inviaMessaggio, t]
  );

  const confermaElimina = async () => {
    if (!daEliminare) return;
    try {
      await eliminaMessaggio.mutateAsync({ classeId, messaggioId: daEliminare.id });
      toast.success(t('chat.eliminato'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setDaEliminare(null);
    }
  };

  const puoModerare = isAdmin || ruoloNellaClasse === 'insegnante';
  const invioInCorso = inviaMessaggio.isPending || inviaAllegato.isPending;
  const titolo = data?.aula?.nome ?? t('chat.title');

  return (
    <div className={styles.main}>
      <div className={styles.finestraHead}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label={t('chat.tornaAlleAule')}
        >
          ←
        </button>
        <h2 className={styles.finestraTitolo}>{titolo}</h2>
      </div>

      <div className={styles.feed} ref={feedRef}>
        {isLoading && (
          <div className={styles.feedCentro}>
            <Spinner />
          </div>
        )}

        {isError && !isLoading && (
          <div className={styles.feedCentro}>
            <ErrorState message={t('chat.errore')} onRetry={refetch} />
          </div>
        )}

        {!isLoading && !isError && messaggi.length === 0 && (
          <div className={styles.feedCentro}>
            <EmptyState title={t('chat.vuota.title')} description={t('chat.vuota.descrizione')} />
          </div>
        )}

        {!isLoading && !isError && messaggi.length > 0 && (
          <>
            {haAltri && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.caricaAltri}
                onClick={caricaAltri}
                isLoading={caricandoAltri}
              >
                {t('chat.caricaAltri')}
              </Button>
            )}

            {messaggi.map((messaggio, indice) => {
              const precedente = messaggi[indice - 1];
              const nuovoGiorno =
                !precedente ||
                chiaveGiorno(precedente.created_at) !== chiaveGiorno(messaggio.created_at);
              const mia = utente && String(messaggio.mittenteId) === String(utente.id);
              const etichetta = etichettaGiorno(messaggio.created_at, lang);

              return (
                <div key={messaggio.id}>
                  {nuovoGiorno && (
                    <div className={styles.giornoDivisore}>
                      {etichetta === 'oggi'
                        ? t('chat.oggi')
                        : etichetta === 'ieri'
                        ? t('chat.ieri')
                        : etichetta}
                    </div>
                  )}
                  <ChatMessaggio
                    messaggio={messaggio}
                    mia={mia}
                    classeId={classeId}
                    puoEliminare={puoModerare || mia}
                    onElimina={setDaEliminare}
                  />
                </div>
              );
            })}
          </>
        )}

        <div ref={fondoRef} />
      </div>

      <ChatComposer onInvia={handleInvia} invioInCorso={invioInCorso} />

      <ConfirmDialog
        isOpen={Boolean(daEliminare)}
        title={t('chat.confermaElimina.title')}
        description={t('chat.confermaElimina.descrizione')}
        confirmLabel={t('chat.confermaElimina.conferma')}
        cancelLabel={t('common.cancel')}
        isLoading={eliminaMessaggio.isPending}
        onConfirm={confermaElimina}
        onCancel={() => setDaEliminare(null)}
      />
    </div>
  );
};

export default ChatFinestra;
