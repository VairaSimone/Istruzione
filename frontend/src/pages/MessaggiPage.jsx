import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRicevuti, useInviati, useNote } from '../hooks/useMessaggi';
import { useAuthStore, selectCanManage } from '../store/authStore';
import MessaggioListItem from '../features/messaggi/components/MessaggioListItem';
import ComposeMessaggioModal from '../features/messaggi/components/ComposeMessaggioModal';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/messaggi/components/Messaggi.module.css';

const LIMIT = 15;

/** Messaggistica: posta ricevuta, inviata e note private (docente). */
const MessaggiPage = () => {
  const { t } = useTranslation();
  const canManage = useAuthStore(selectCanManage);
  const [tab, setTab] = useState('ricevuti');
  const [page, setPage] = useState(1);
  const [soloNonLetti, setSoloNonLetti] = useState(false);
  const [isComposeOpen, setComposeOpen] = useState(false);

  const ricevuti = useRicevuti({
    page,
    limit: LIMIT,
    ...(soloNonLetti && { nonLetti: true }),
  });
  const inviati = useInviati({ page, limit: LIMIT });
  const note = useNote({ page, limit: LIMIT });

  const active =
    tab === 'inviati' ? inviati : tab === 'note' ? note : ricevuti;
  const items =
    tab === 'inviati'
      ? inviati.data?.messaggi
      : tab === 'note'
        ? note.data?.note
        : ricevuti.data?.messaggi;
  const list = items ?? [];
  const paginazione = active.data?.paginazione;

  const changeTab = (next) => {
    setTab(next);
    setPage(1);
  };

  const variant = tab === 'inviati' ? 'inviato' : tab === 'note' ? 'nota' : 'ricevuto';

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('messaggi.title')}</h1>
          <p className={styles.pageSubtitle}>{t('messaggi.subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={() => setComposeOpen(true)}>{t('messaggi.compose.new')}</Button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, tab === 'ricevuti' ? styles.tabActive : ''].join(' ')}
          onClick={() => changeTab('ricevuti')}
        >
          {t('messaggi.tabs.ricevuti')}
        </button>
        {canManage && (
          <button
            type="button"
            className={[styles.tab, tab === 'inviati' ? styles.tabActive : ''].join(' ')}
            onClick={() => changeTab('inviati')}
          >
            {t('messaggi.tabs.inviati')}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            className={[styles.tab, tab === 'note' ? styles.tabActive : ''].join(' ')}
            onClick={() => changeTab('note')}
          >
            {t('messaggi.tabs.note')}
          </button>
        )}
      </div>

      {tab === 'ricevuti' && (
        <div className={styles.actionsRow}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={soloNonLetti}
              onChange={(e) => {
                setSoloNonLetti(e.target.checked);
                setPage(1);
              }}
            />
            {t('messaggi.onlyUnread')}
          </label>
        </div>
      )}

      {active.isLoading && <Spinner size="lg" />}
      {active.isError && <p className={styles.emptyText}>{t('messaggi.loadError')}</p>}

      {!active.isLoading && !active.isError && list.length === 0 && (
        <p className={styles.emptyText}>{t('messaggi.empty')}</p>
      )}

      {list.length > 0 && (
        <div className={styles.list}>
          {list.map((m) => (
            <MessaggioListItem key={m.id} messaggio={m} variant={variant} />
          ))}
        </div>
      )}

      {paginazione && paginazione.totalePagine > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className={styles.pageInfo}>
            {t('common.pageOf', {
              page: paginazione.paginaCorrente,
              total: paginazione.totalePagine,
            })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= paginazione.totalePagine}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      {isComposeOpen && (
        <ComposeMessaggioModal isOpen onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
};

export default MessaggiPage;
