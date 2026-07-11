import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  useEvento,
  useDeleteEvento,
  useAddDestinatario,
  useRemoveDestinatario,
} from '../../../hooks/useCalendario';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { formatDateTime, formatDate } from '../../../utils/datetime';
import { TIPO_EVENTO_TONE } from '../../../constants/tipiEvento';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import SelettoreDestinatario from './SelettoreDestinatario';
import styles from './Calendario.module.css';

/** Pannello di gestione destinatari (solo eventi propri: usa gli endpoint API). */
const DestinatariManager = ({ eventoId, destinatari }) => {
  const { t } = useTranslation();
  const addDestinatario = useAddDestinatario();
  const removeDestinatario = useRemoveDestinatario();

  const aggiungi = async ({ classeId, utenteId }) => {
    try {
      await addDestinatario.mutateAsync({ id: eventoId, classeId, utenteId });
      toast.success(t('calendario.toast.destinatarioAdded'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const rimuovi = async (destinatarioId) => {
    try {
      await removeDestinatario.mutateAsync({ id: eventoId, destinatarioId });
      toast.success(t('calendario.toast.destinatarioRemoved'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <div className={styles.destinatariBox}>
      <span className={styles.destinatariTitle}>{t('calendario.destinatari.title')}</span>

      {destinatari.length === 0 ? (
        <p className={styles.emptyText}>{t('calendario.destinatari.empty')}</p>
      ) : (
        <div className={styles.chipsList}>
          {destinatari.map((d) => {
            const etichetta = d.classe
              ? d.classe.nome
              : d.studente
                ? `${d.studente.nome} ${d.studente.cognome}`
                : '—';
            return (
              <span key={d.id} className={styles.destinatarioChip}>
                {d.classe ? '👥' : '👤'} {etichetta}
                <button
                  type="button"
                  className={styles.destinatarioRemove}
                  onClick={() => rimuovi(d.id)}
                  aria-label={t('common.remove')}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <SelettoreDestinatario onAggiungi={aggiungi} isPending={addDestinatario.isPending} />
    </div>
  );
};

/**
 * Dettaglio di una voce del calendario.
 *
 * Le informazioni di base arrivano dalla `voce` del feed, così anche lo studente
 * (che non può interrogare l'endpoint di dettaglio) vede tutto: titolo, orario,
 * luogo, descrizione e link alla videochiamata. Solo per gli eventi PROPRI
 * (`voce.modificabile`) carichiamo il dettaglio completo con i destinatari e
 * mostriamo modifica/eliminazione.
 */
const EventoDettaglioModal = ({ isOpen, onClose, voce, onModifica }) => {
  const { t, i18n } = useTranslation();
  const [confermaElimina, setConfermaElimina] = useState(false);
  const deleteEvento = useDeleteEvento();

  const puoGestire = Boolean(voce?.modificabile) && voce?.tipoVoce === 'evento';

  // Dettaglio con destinatari: solo per eventi propri (l'endpoint è riservato).
  const { data: dettaglio } = useEvento(puoGestire && isOpen ? voce.id : undefined);
  const destinatari = dettaglio?.destinatari ?? [];

  if (!voce) return null;

  const isCompito = voce.tipoVoce === 'compito';
  const lang = i18n.language;

  const handleElimina = async () => {
    try {
      await deleteEvento.mutateAsync(voce.id);
      toast.success(t('calendario.toast.deleted'));
      setConfermaElimina(false);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const quando = voce.tuttoIlGiorno
    ? formatDate(voce.dataInizio, lang)
    : formatDateTime(voce.dataInizio, lang);
  const fine = voce.dataFine
    ? voce.tuttoIlGiorno
      ? formatDate(voce.dataFine, lang)
      : formatDateTime(voce.dataFine, lang)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={voce.titolo}
      footer={
        puoGestire ? (
          <>
            <Button variant="danger" onClick={() => setConfermaElimina(true)}>
              {t('common.delete')}
            </Button>
            <Button onClick={() => onModifica(voce)}>{t('common.edit')}</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        )
      }
    >
      <div className={styles.detail}>
        <div className={styles.detailHead}>
          {isCompito ? (
            <Badge tone="danger">{t('calendario.voce.scadenzaCompito')}</Badge>
          ) : (
            <Badge tone={TIPO_EVENTO_TONE[voce.tipo] || 'neutral'}>
              {t(`calendario.tipi.${voce.tipo}`, voce.tipo)}
            </Badge>
          )}
          {isCompito && voce.statoStudente && (
            <Badge tone="neutral">{t(`compiti.statiStudente.${voce.statoStudente}`)}</Badge>
          )}
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{t('calendario.detail.quando')}</span>
          <span className={styles.detailValue}>{quando}</span>
        </div>
        {fine && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t('calendario.detail.fine')}</span>
            <span className={styles.detailValue}>{fine}</span>
          </div>
        )}
        {voce.luogo && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t('calendario.detail.luogo')}</span>
            <span className={styles.detailValue}>{voce.luogo}</span>
          </div>
        )}

        {voce.descrizione && <p className={styles.descrizione}>{voce.descrizione}</p>}

        {voce.linkVideochiamata && (
          <div className={styles.joinBox}>
            <div className={styles.joinInfo}>
              <span className={styles.joinPlatform}>
                {t('calendario.detail.videochiamata')}
                {voce.piattaformaVideochiamata
                  ? ` · ${t(`calendario.piattaforme.${voce.piattaformaVideochiamata}`, voce.piattaformaVideochiamata)}`
                  : ''}
              </span>
              <span className={styles.joinLink}>{voce.linkVideochiamata}</span>
            </div>
            <a
              className={styles.joinButton}
              href={voce.linkVideochiamata}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('calendario.detail.partecipa')}
            </a>
          </div>
        )}

        {isCompito && (
          <p className={styles.emptyText}>{t('calendario.detail.compitoHint')}</p>
        )}

        {puoGestire && <DestinatariManager eventoId={voce.id} destinatari={destinatari} />}
      </div>

      <ConfirmDialog
        isOpen={confermaElimina}
        title={t('calendario.delete.title')}
        description={t('calendario.delete.description', { titolo: voce.titolo })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isLoading={deleteEvento.isPending}
        onConfirm={handleElimina}
        onCancel={() => setConfermaElimina(false)}
      />
    </Modal>
  );
};

export default EventoDettaglioModal;
