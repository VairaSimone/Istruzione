import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATI_RICHIESTA, TIPI_RICHIESTA } from '../../../validators/contattiSchemas';
import { useRichieste } from '../../../hooks/useContatti';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Select from '../../../components/ui/Select';
import TextField from '../../../components/ui/TextField';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/shared/EmptyState';
import ErrorState from '../../../components/shared/ErrorState';
import Pagination from '../../../components/shared/Pagination';
import RichiestaContattoRow from './RichiestaContattoRow';
import RichiestaContattoDetailModal from './RichiestaContattoDetailModal';
import styles from './Contatti.module.css';

const PER_PAGINA = 20;

/**
 * Inbox dei lead ricevuti dal form della homepage.
 *
 * Filtra per stato, tipo e testo (nome/email), con paginazione. L'admin opera
 * su una scuola scelta a monte (`scuolaId`); lo staff sulla propria. Cliccando
 * una riga si apre il dettaglio, dove si cambia stato, si prende in carico, si
 * annotano note interne o si elimina.
 *
 * @param {string}  [scuolaId]  tenant (obbligatorio per l'admin)
 * @param {boolean} [attesaScuola]  admin senza scuola selezionata ⇒ invito a sceglierne una
 */
const ContattiInbox = ({ scuolaId, attesaScuola = false }) => {
  const { t } = useTranslation();

  const [stato, setStato] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selezionata, setSelezionata] = useState(null);

  const filtri = useMemo(
    () => ({
      ...(scuolaId ? { scuolaId } : {}),
      ...(stato ? { stato } : {}),
      ...(tipo ? { tipo } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      page,
      limit: PER_PAGINA,
    }),
    [scuolaId, stato, tipo, q, page]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useRichieste(filtri, {
    enabled: !attesaScuola,
  });

  const richieste = data?.richieste ?? [];
  const paginazione = data?.paginazione ?? null;

  const cambiaFiltro = (setter) => (valore) => {
    setPage(1);
    setter(valore);
  };

  if (attesaScuola) {
    return <EmptyState title={t('contatti.selezionaScuola.titolo')} description={t('contatti.selezionaScuola.descrizione')} />;
  }

  return (
    <div>
      <div className={styles.barra}>
        <div className={styles.filtro}>
          <Select
            label={t('contatti.filtri.stato')}
            value={stato}
            placeholder={t('contatti.filtri.tutti')}
            onChange={(e) => cambiaFiltro(setStato)(e.target.value)}
          >
            <option value="">{t('contatti.filtri.tutti')}</option>
            {STATI_RICHIESTA.map((s) => (
              <option key={s} value={s}>
                {t(`contatti.stati.${s}`, { defaultValue: s })}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.filtro}>
          <Select
            label={t('contatti.filtri.tipo')}
            value={tipo}
            placeholder={t('contatti.filtri.tutti')}
            onChange={(e) => cambiaFiltro(setTipo)(e.target.value)}
          >
            <option value="">{t('contatti.filtri.tutti')}</option>
            {TIPI_RICHIESTA.map((tp) => (
              <option key={tp} value={tp}>
                {t(`contatti.tipi.${tp}`, { defaultValue: tp })}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.ricerca}>
          <TextField
            label={t('contatti.filtri.ricerca')}
            value={q}
            placeholder={t('contatti.filtri.ricercaPlaceholder')}
            onChange={(e) => cambiaFiltro(setQ)(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner size="lg" label={t('common.loading')} />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(t, error)} onRetry={refetch} />
      ) : richieste.length === 0 ? (
        <EmptyState title={t('contatti.vuoto.titolo')} description={t('contatti.vuoto.descrizione')} />
      ) : (
        <>
          <ul className={styles.lista}>
            {richieste.map((r) => (
              <RichiestaContattoRow key={r.id} richiesta={r} onOpen={setSelezionata} />
            ))}
          </ul>

          {paginazione && (
            <Pagination
              paginaCorrente={paginazione.paginaCorrente}
              totalePagine={paginazione.totalePagine}
              isFetching={isFetching}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <RichiestaContattoDetailModal
        key={selezionata?.id}
        richiesta={selezionata}
        isOpen={Boolean(selezionata)}
        onClose={() => setSelezionata(null)}
      />
    </div>
  );
};

export default ContattiInbox;
