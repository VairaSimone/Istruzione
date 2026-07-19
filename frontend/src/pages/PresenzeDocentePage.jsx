import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuleList } from '../hooks/useAule';
import {
  useRegistri,
  useRegistro,
  useRiepilogoAula,
  useCreateRegistro,
  useSaveVoci,
  useDeleteRegistro,
} from '../hooks/usePresenze';
import { STATO_PRESENZA_TONE, prossimoStato } from '../constants/statiPresenza';
import Select from '../components/ui/Select';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import styles from '../features/presenze/components/Presenze.module.css';

const oggiISO = () => new Date().toISOString().slice(0, 10);

/**
 * Registro presenze — vista dell'INSEGNANTE.
 *
 * Flusso: scegli un'aula -> apri (o seleziona) l'appello di un giorno -> segna
 * le presenze toccando le pastiglie di stato -> salva. La scheda "Riepilogo"
 * mostra le assenze per studente e segnala chi supera il limite fissato dalla
 * scuola.
 *
 * `bozza` contiene SOLO le modifiche locali (utenteId -> nuovo stato) come
 * overlay sugli stati salvati: nessuno stato derivato da props via effetto, cosi'
 * il flusso resta effect-free. Si azzera esplicitamente quando cambia l'appello
 * selezionato (aula, data, apertura).
 */
const PresenzeDocentePage = () => {
  const { t } = useTranslation();

  const [classeId, setClasseId] = useState('');
  const [tab, setTab] = useState('appello'); // 'appello' | 'riepilogo'
  const [data, setData] = useState(oggiISO());
  const [registroId, setRegistroId] = useState(null);
  const [bozza, setBozza] = useState({}); // overlay: utenteId -> stato modificato

  const { data: auleData, isLoading: auleLoading } = useAuleList();
  const aule = auleData?.classi ?? [];

  const { data: registriData } = useRegistri(classeId ? { classeId } : {});
  const { data: registro, isLoading: registroLoading } = useRegistro(registroId);
  const { data: riepilogo, isLoading: riepilogoLoading } = useRiepilogoAula(
    tab === 'riepilogo' ? classeId : null
  );

  const createRegistro = useCreateRegistro();
  const saveVoci = useSaveVoci();
  const deleteRegistro = useDeleteRegistro();

  const registroDelGiorno = useMemo(
    () => (registriData?.registri ?? []).find((r) => r.data === data) || null,
    [registriData, data]
  );

  /** Seleziona un appello azzerando le modifiche locali del precedente. */
  const selezionaRegistro = (id) => {
    setRegistroId(id);
    setBozza({});
  };

  const cambiaAula = (id) => {
    setClasseId(id);
    setRegistroId(null);
    setBozza({});
  };

  const cambiaData = (nuovaData) => {
    setData(nuovaData);
    setRegistroId(null);
    setBozza({});
  };

  const apriAppello = async () => {
    if (registroDelGiorno) {
      selezionaRegistro(registroDelGiorno.id);
      return;
    }
    const creato = await createRegistro.mutateAsync({ classeId, data });
    selezionaRegistro(creato.id);
  };

  const statoDi = (voce) => bozza[voce.utenteId] ?? voce.stato;

  const salva = async () => {
    if (!registro) return;
    const voci = registro.voci.map((v) => ({ utenteId: v.utenteId, stato: statoDi(v) }));
    await saveVoci.mutateAsync({ id: registro.id, voci });
    setBozza({});
  };

  const eliminaAppello = async () => {
    if (!registro) return;
    await deleteRegistro.mutateAsync(registro.id);
    setRegistroId(null);
    setBozza({});
  };

  const modificato = registro?.voci?.some((v) => statoDi(v) !== v.stato);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('presenze.docente.title')}</h1>
          <p className={styles.pageSubtitle}>{t('presenze.docente.subtitle')}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <Select
            label={t('presenze.docente.aula')}
            value={classeId}
            onChange={(e) => cambiaAula(e.target.value)}
            placeholder={auleLoading ? t('common.loading') : t('presenze.docente.selezionaAula')}
          >
            {aule.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {classeId && (
        <>
          <div className={styles.actions} style={{ marginBottom: 'var(--space-4)' }}>
            <Button
              variant={tab === 'appello' ? 'primary' : 'secondary'}
              onClick={() => setTab('appello')}
            >
              {t('presenze.docente.tabAppello')}
            </Button>
            <Button
              variant={tab === 'riepilogo' ? 'primary' : 'secondary'}
              onClick={() => setTab('riepilogo')}
            >
              {t('presenze.docente.tabRiepilogo')}
            </Button>
          </div>

          {tab === 'appello' && (
            <>
              <div className={styles.toolbar}>
                <div className={styles.toolbarField}>
                  <TextField
                    label={t('presenze.docente.data')}
                    type="date"
                    value={data}
                    onChange={(e) => cambiaData(e.target.value)}
                  />
                </div>
                <Button onClick={apriAppello} disabled={createRegistro.isPending}>
                  {registroDelGiorno
                    ? t('presenze.docente.apriEsistente')
                    : t('presenze.docente.nuovoAppello')}
                </Button>
              </div>

              {createRegistro.isError && (
                <p className={styles.emptyText}>{getApiErrorMessage(t, createRegistro.error)}</p>
              )}

              {registroLoading && <Spinner size="lg" />}

              {registro && !registroLoading && (
                <div className={styles.card}>
                  {registro.voci.length === 0 && (
                    <p className={styles.emptyText}>{t('presenze.docente.nessunoStudente')}</p>
                  )}

                  {registro.voci.map((v) => {
                    const stato = statoDi(v);
                    return (
                      <div key={v.utenteId} className={styles.rosterRow}>
                        <div>
                          <span className={styles.studentName}>
                            {v.studente?.cognome} {v.studente?.nome}
                          </span>
                          <span className={styles.studentEmail}>{v.studente?.email}</span>
                        </div>
                        <button
                          type="button"
                          className={styles.statePill}
                          onClick={() =>
                            setBozza((b) => ({ ...b, [v.utenteId]: prossimoStato(stato) }))
                          }
                          title={t('presenze.docente.cambiaStato')}
                        >
                          <Badge tone={STATO_PRESENZA_TONE[stato] ?? 'neutral'}>
                            {t(`presenze.stati.${stato}`)}
                          </Badge>
                        </button>
                      </div>
                    );
                  })}

                  {registro.voci.length > 0 && (
                    <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>
                      <Button onClick={salva} disabled={!modificato || saveVoci.isPending}>
                        {t('presenze.docente.salva')}
                      </Button>
                      <Button variant="danger" onClick={eliminaAppello} disabled={deleteRegistro.isPending}>
                        {t('presenze.docente.elimina')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'riepilogo' && (
            <>
              {riepilogoLoading && <Spinner size="lg" />}
              {riepilogo && !riepilogoLoading && (
                <>
                  <div className={styles.summaryBar}>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>{riepilogo.totaleSessioni}</div>
                      <div className={styles.summaryLabel}>{t('presenze.riepilogo.sessioni')}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>
                        {riepilogo.limiteAssenze ?? t('presenze.riepilogo.nessunLimite')}
                      </div>
                      <div className={styles.summaryLabel}>{t('presenze.riepilogo.limite')}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>{riepilogo.studentiOltreLimite}</div>
                      <div className={styles.summaryLabel}>{t('presenze.riepilogo.oltreLimite')}</div>
                    </div>
                  </div>

                  {riepilogo.studenti.length === 0 ? (
                    <p className={styles.emptyText}>{t('presenze.docente.nessunoStudente')}</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('presenze.riepilogo.studente')}</th>
                          <th>{t('presenze.riepilogo.assenze')}</th>
                          <th>{t('presenze.riepilogo.conteggiate')}</th>
                          <th>{t('presenze.riepilogo.ritardi')}</th>
                          <th>{t('presenze.riepilogo.stato')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riepilogo.studenti.map((r) => (
                          <tr key={r.studente.id} className={r.oltreLimite ? styles.rowFlag : ''}>
                            <td>
                              {r.studente.cognome} {r.studente.nome}
                            </td>
                            <td>{r.assenze}</td>
                            <td>{r.assenzeConteggiate}</td>
                            <td>{r.ritardi}</td>
                            <td>
                              {r.oltreLimite ? (
                                <Badge tone="danger">{t('presenze.riepilogo.superato')}</Badge>
                              ) : (
                                <Badge tone="matcha">{t('presenze.riepilogo.regolare')}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PresenzeDocentePage;
