import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalendarioFeed } from '../hooks/useCalendario';
import { useAuthStore, selectCanManage } from '../store/authStore';
import { finestraGrigliaMese, etichettaMese } from '../features/calendario/calendarioDate';
import {
  compitoDetailPath,
  compitoStudenteDetailPath,
} from '../constants/routes';
import CalendarioMese from '../features/calendario/components/CalendarioMese';
import EventoDettaglioModal from '../features/calendario/components/EventoDettaglioModal';
import GiornoEventiModal from '../features/calendario/components/GiornoEventiModal';
import EventoFormModal from '../features/calendario/components/EventoFormModal';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import {
  TIPI_EVENTO,
  COLORI_EVENTO,
  COLORE_SCADENZA_COMPITO,
} from '../constants/tipiEvento';
import styles from '../features/calendario/components/Calendario.module.css';

/** Primo giorno del mese di una data. */
const primoDelMese = (data) => new Date(data.getFullYear(), data.getMonth(), 1);

const FILTRI = ['', 'evento', 'compito'];

/**
 * Calendario condiviso di studenti e insegnanti.
 *
 * Mostra, mese per mese, la vista unificata del feed: gli eventi (lezioni,
 * riunioni, verifiche, videochiamate con link) e le scadenze dei compiti.
 * Gli insegnanti possono creare/modificare/eliminare i propri eventi; per tutti
 * il click su una scadenza porta al relativo compito.
 */
const CalendarioPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canManage = useAuthStore(selectCanManage);

  const [mese, setMese] = useState(() => primoDelMese(new Date()));
  const [filtro, setFiltro] = useState(''); // '' | 'evento' | 'compito'

  const [voceSelezionata, setVoceSelezionata] = useState(null);
  const [giornoSelezionato, setGiornoSelezionato] = useState(null);
  const [giornoVoci, setGiornoVoci] = useState([]);
  const [formAperto, setFormAperto] = useState(false);
  const [eventoInModifica, setEventoInModifica] = useState(null);
  const [dataIniziale, setDataIniziale] = useState(null);

  const finestra = useMemo(() => finestraGrigliaMese(mese), [mese]);
  const filtriQuery = useMemo(
    () => ({ da: finestra.da, a: finestra.a, ...(filtro && { tipoVoce: filtro }) }),
    [finestra, filtro]
  );

  const { data, isLoading, isError } = useCalendarioFeed(filtriQuery);
  const voci = data?.voci ?? [];

  // ── Navigazione mese ──
  const spostaMese = (delta) =>
    setMese((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const vaiOggi = () => setMese(primoDelMese(new Date()));

  // ── Selezione voce ──
  const apriVoce = (voce) => {
    setGiornoSelezionato(null);
    if (voce.tipoVoce === 'compito') {
      const path =
        user?.ruolo === 'studente'
          ? compitoStudenteDetailPath(voce.id)
          : compitoDetailPath(voce.id);
      navigate(path);
      return;
    }
    setVoceSelezionata(voce);
  };

  const apriGiorno = (giorno, vociGiorno) => {
    setGiornoSelezionato(giorno);
    setGiornoVoci(vociGiorno);
  };

  // ── Creazione / modifica ──
  const nuovoEvento = (giorno = null) => {
    setEventoInModifica(null);
    setDataIniziale(giorno ? new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate(), 9, 0) : null);
    setGiornoSelezionato(null);
    setFormAperto(true);
  };

  const modificaEvento = (voce) => {
    setVoceSelezionata(null);
    setEventoInModifica(voce);
    setDataIniziale(null);
    setFormAperto(true);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('calendario.page.title')}</h1>
          <p className={styles.pageSubtitle}>{t('calendario.page.subtitle')}</p>
        </div>
        {canManage && <Button onClick={() => nuovoEvento()}>{t('calendario.list.create')}</Button>}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <Button variant="secondary" size="sm" onClick={() => spostaMese(-1)}>
            ‹
          </Button>
          <span className={styles.monthLabel}>{etichettaMese(mese, i18n.language)}</span>
          <Button variant="secondary" size="sm" onClick={() => spostaMese(1)}>
            ›
          </Button>
          <Button variant="ghost" size="sm" onClick={vaiOggi}>
            {t('calendario.toolbar.today')}
          </Button>
        </div>

        <div className={styles.toggle}>
          {FILTRI.map((f) => (
            <Button
              key={f || 'tutti'}
              variant={filtro === f ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFiltro(f)}
            >
              {t(`calendario.filtro.${f || 'tutti'}`)}
            </Button>
          ))}
        </div>
      </div>

      {isError && <p className={styles.emptyText}>{t('calendario.page.loadError')}</p>}
      {isLoading && !data ? (
        <Spinner size="lg" />
      ) : (
        <CalendarioMese
          mese={mese}
          voci={voci}
          onSelezionaVoce={apriVoce}
          onSelezionaGiorno={apriGiorno}
        />
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: COLORI_EVENTO[TIPI_EVENTO.VIDEOCHIAMATA] }}
          />
          {t('calendario.tipi.videochiamata')}
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: COLORI_EVENTO[TIPI_EVENTO.LEZIONE] }}
          />
          {t('calendario.tipi.lezione')}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: COLORE_SCADENZA_COMPITO }} />
          {t('calendario.voce.scadenzaCompito')}
        </span>
      </div>

      <EventoDettaglioModal
        isOpen={Boolean(voceSelezionata)}
        onClose={() => setVoceSelezionata(null)}
        voce={voceSelezionata}
        onModifica={modificaEvento}
      />

      <GiornoEventiModal
        isOpen={Boolean(giornoSelezionato)}
        onClose={() => setGiornoSelezionato(null)}
        giorno={giornoSelezionato}
        voci={giornoVoci}
        onSelezionaVoce={apriVoce}
        onNuovoEvento={nuovoEvento}
        puoCreare={canManage}
      />

      {formAperto && (
        <EventoFormModal
          isOpen={formAperto}
          onClose={() => setFormAperto(false)}
          evento={eventoInModifica}
          dataIniziale={dataIniziale}
        />
      )}
    </div>
  );
};

export default CalendarioPage;
