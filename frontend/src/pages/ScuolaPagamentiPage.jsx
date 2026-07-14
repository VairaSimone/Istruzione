import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  useConfigPagamenti,
  useAvviaOnboarding,
  useSincronizzaOnboarding,
  useAggiornaConfigPagamenti,
  usePagamentiScuola,
} from '../hooks/usePagamenti';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/pagamenti/components/Pagamenti.module.css';

const TONE_STATO = {
  completato: 'matcha',
  in_attesa: 'neutral',
  fallito: 'danger',
  annullato: 'danger',
  rimborsato: 'gold',
};

/**
 * Pagina STAFF di configurazione dei pagamenti della scuola:
 *   - onboarding Stripe Connect (collega/riprendi, sincronizza stato);
 *   - interruttore "usa Stripe";
 *   - elenco degli incassi ricevuti.
 *
 * La percentuale di commissione della piattaforma è decisa dall'ADMIN
 * (pannello scuole) e qui è mostrata in sola lettura.
 */
const ScuolaPagamentiPage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const { data: config, isLoading, isError } = useConfigPagamenti();
  const avviaOnboarding = useAvviaOnboarding();
  const sincronizza = useSincronizzaOnboarding();
  const aggiornaConfig = useAggiornaConfigPagamenti();
  const { data: pagamenti = [], isLoading: caricaIncassi } = usePagamentiScuola();

  // Al ritorno dall'onboarding (?onboarding=completato) sincronizza lo stato.
  useEffect(() => {
    if (params.get('onboarding')) {
      sincronizza.mutate(undefined, {
        onSettled: () => {
          params.delete('onboarding');
          setParams(params, { replace: true });
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const piattaformaConfigurata = config?.piattaformaConfigurata;
  const onboardingCompletato = config?.onboardingCompletato;
  const operativi = config?.operativi;
  const stripeAttivi = config?.stripeAttivi;
  const commissione = config?.commissionePiattaformaPercentuale;

  const onCollega = async () => {
    try {
      await avviaOnboarding.mutateAsync(); // reindirizza a Stripe
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const onSincronizza = async () => {
    try {
      await sincronizza.mutateAsync();
      toast.success(t('pagamenti.config.statoAggiornato'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const onToggleAttivi = async (attivi) => {
    try {
      await aggiornaConfig.mutateAsync({ attivi });
      toast.success(t('pagamenti.config.salvato'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isLoading) return <Spinner size="lg" />;
  if (isError) return <p className={styles.emptyText}>{t('pagamenti.config.loadError')}</p>;

  return (
    <div className={styles.section}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('pagamenti.config.title')}</h1>
          <p className={styles.pageSubtitle}>{t('pagamenti.config.subtitle')}</p>
        </div>
      </div>

      {!piattaformaConfigurata && (
        <div className={`${styles.avviso} ${styles.avvisoWarn}`}>
          {t('pagamenti.config.piattaformaNonConfigurata')}
        </div>
      )}

      {/* ── Onboarding Connect ── */}
      <Card padding="lg">
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('pagamenti.config.onboardingTitolo')}</h2>
          <p className={styles.panelText}>{t('pagamenti.config.onboardingTesto')}</p>

          <div className={styles.statoRow}>
            <span className={styles.panelText}>{t('pagamenti.config.statoAccount')}:</span>
            <Badge tone={onboardingCompletato ? 'matcha' : 'neutral'}>
              {onboardingCompletato
                ? t('pagamenti.config.accountAttivo')
                : t('pagamenti.config.accountNonAttivo')}
            </Badge>
          </div>

          <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
            <Button
              onClick={onCollega}
              disabled={!piattaformaConfigurata}
              isLoading={avviaOnboarding.isPending}
            >
              {config?.stripeAccountId
                ? t('pagamenti.config.riprendiOnboarding')
                : t('pagamenti.config.collegaStripe')}
            </Button>
            {config?.stripeAccountId && (
              <Button
                variant="secondary"
                onClick={onSincronizza}
                isLoading={sincronizza.isPending}
              >
                {t('pagamenti.config.sincronizza')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Interruttore uso Stripe ── */}
      <Card padding="lg">
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('pagamenti.config.usoTitolo')}</h2>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={Boolean(stripeAttivi)}
              disabled={!piattaformaConfigurata || aggiornaConfig.isPending}
              onChange={(e) => onToggleAttivi(e.target.checked)}
            />
            <span className={styles.checkboxLabel}>
              <span className={styles.checkboxTitle}>{t('pagamenti.config.usaStripe')}</span>
              <span className={styles.checkboxHint}>{t('pagamenti.config.usaStripeHint')}</span>
            </span>
          </label>

          <div className={styles.statoRow}>
            <span className={styles.panelText}>{t('pagamenti.config.statoOperativo')}:</span>
            <Badge tone={operativi ? 'matcha' : 'neutral'}>
              {operativi
                ? t('pagamenti.config.operativo')
                : t('pagamenti.config.nonOperativo')}
            </Badge>
          </div>

          <p className={styles.panelText}>
            {t('pagamenti.config.commissione', {
              perc:
                commissione == null
                  ? '0'
                  : commissione.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            })}
          </p>
        </div>
      </Card>

      {/* ── Incassi ── */}
      <Card padding="lg">
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('pagamenti.config.incassiTitolo')}</h2>

          {caricaIncassi && <Spinner />}
          {!caricaIncassi && pagamenti.length === 0 && (
            <p className={styles.panelText}>{t('pagamenti.config.incassiVuoti')}</p>
          )}

          {pagamenti.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('pagamenti.config.colCorso')}</th>
                    <th>{t('pagamenti.config.colImporto')}</th>
                    <th>{t('pagamenti.config.colStato')}</th>
                    <th>{t('pagamenti.config.colData')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamenti.map((p) => (
                    <tr key={p.id}>
                      <td>{p.corso?.titolo ?? '—'}</td>
                      <td>{p.importoFormattato}</td>
                      <td>
                        <Badge tone={TONE_STATO[p.stato] ?? 'neutral'}>
                          {t(`pagamenti.stati.${p.stato}`)}
                        </Badge>
                      </td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ScuolaPagamentiPage;
