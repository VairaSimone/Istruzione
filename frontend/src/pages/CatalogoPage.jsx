import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCatalogo, useCreaCheckout } from '../hooks/usePagamenti';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import CorsoAcquistabileCard from '../features/pagamenti/components/CorsoAcquistabileCard';
import Spinner from '../components/ui/Spinner';
import styles from '../features/pagamenti/components/Pagamenti.module.css';

/**
 * Catalogo dei corsi a pagamento della scuola dello studente. Prezzi e
 * descrizioni sono personalizzati per scuola (lato backend). L'acquisto avvia il
 * checkout Stripe; a pagamento avvenuto lo studente viene iscritto in automatico
 * nell'aula di destinazione.
 */
const CatalogoPage = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCatalogo();
  const checkout = useCreaCheckout();

  const operativo = data?.operativo;
  const corsi = data?.corsi ?? [];

  const acquista = async (corsoId) => {
    try {
      // In caso di successo l'hook reindirizza a Stripe (window.location).
      await checkout.mutateAsync(corsoId);
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('pagamenti.catalogo.title')}</h1>
          <p className={styles.pageSubtitle}>{t('pagamenti.catalogo.subtitle')}</p>
        </div>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('pagamenti.catalogo.loadError')}</p>}

      {!isLoading && !isError && !operativo && (
        <div className={styles.avviso}>{t('pagamenti.catalogo.nonOperativo')}</div>
      )}

      {!isLoading && !isError && operativo && corsi.length === 0 && (
        <p className={styles.emptyText}>{t('pagamenti.catalogo.empty')}</p>
      )}

      {corsi.length > 0 && (
        <div className={styles.grid}>
          {corsi.map((corso) => (
            <CorsoAcquistabileCard
              key={corso.id}
              corso={corso}
              onAcquista={acquista}
              isPending={checkout.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogoPage;
