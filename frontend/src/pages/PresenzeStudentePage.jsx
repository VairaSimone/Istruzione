import { useTranslation } from 'react-i18next';
import { useMiePresenze } from '../hooks/usePresenze';
import { STATO_PRESENZA_TONE } from '../constants/statiPresenza';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/presenze/components/Presenze.module.css';

/** Formatta una data ISO 'YYYY-MM-DD' nel locale corrente. */
const formattaData = (iso, lingua) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(lingua, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Registro presenze — vista dello STUDENTE.
 * Mostra il conteggio delle proprie assenze rispetto al limite di scuola e lo
 * storico delle rilevazioni (data, aula, stato).
 */
const PresenzeStudentePage = () => {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useMiePresenze();

  const voci = data?.voci ?? [];
  const r = data?.riepilogo;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('presenze.studente.title')}</h1>
          <p className={styles.pageSubtitle}>{t('presenze.studente.subtitle')}</p>
        </div>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('presenze.studente.loadError')}</p>}

      {r && !isLoading && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{r.sessioni}</div>
            <div className={styles.summaryLabel}>{t('presenze.riepilogo.sessioni')}</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{r.assenze}</div>
            <div className={styles.summaryLabel}>{t('presenze.riepilogo.assenze')}</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>
              {r.assenzeConteggiate}
              {r.limiteAssenze !== null && ` / ${r.limiteAssenze}`}
            </div>
            <div className={styles.summaryLabel}>{t('presenze.riepilogo.conteggiate')}</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>
              {r.oltreLimite ? (
                <Badge tone="danger">{t('presenze.riepilogo.superato')}</Badge>
              ) : (
                <Badge tone="matcha">{t('presenze.riepilogo.regolare')}</Badge>
              )}
            </div>
            <div className={styles.summaryLabel}>{t('presenze.riepilogo.stato')}</div>
          </div>
        </div>
      )}

      {!isLoading && !isError && voci.length === 0 && (
        <p className={styles.emptyText}>{t('presenze.studente.empty')}</p>
      )}

      {voci.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('presenze.studente.data')}</th>
              <th>{t('presenze.studente.aula')}</th>
              <th>{t('presenze.studente.stato')}</th>
              <th>{t('presenze.studente.nota')}</th>
            </tr>
          </thead>
          <tbody>
            {voci.map((v) => (
              <tr key={v.id}>
                <td>{formattaData(v.data, i18n.language)}</td>
                <td>{v.aula?.nome ?? '—'}</td>
                <td>
                  <Badge tone={STATO_PRESENZA_TONE[v.stato] ?? 'neutral'}>
                    {t(`presenze.stati.${v.stato}`)}
                  </Badge>
                </td>
                <td>{v.nota ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PresenzeStudentePage;
