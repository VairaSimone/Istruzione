import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import styles from '../features/pagamenti/components/Pagamenti.module.css';

/**
 * Pagina di ritorno dal checkout Stripe (`/pagamenti/esito?stato=...`).
 *
 * L'esito autorevole arriva comunque dal WEBHOOK lato server (che completa il
 * pagamento e iscrive lo studente): qui diamo solo un riscontro visivo e
 * invalidiamo le cache di catalogo/aule/corsi così, tornando indietro, lo
 * studente vede subito lo stato aggiornato. Un successo mostrato qui non è una
 * conferma di incasso, ma di rientro: il testo lo esplicita.
 */
const PagamentoEsitoPage = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const stato = params.get('stato');
  const successo = stato === 'successo';

  useEffect(() => {
    if (!successo) return;
    // Aggiorna ciò che il completamento del pagamento può aver cambiato.
    queryClient.invalidateQueries({ queryKey: queryKeys.pagamenti.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.corsi.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.aule.all });
  }, [successo, queryClient]);

  return (
    <Card className={styles.esito} padding="lg">
      <div
        className={`${styles.esitoIcona} ${successo ? styles.esitoOk : styles.esitoKo}`}
        aria-hidden="true"
      >
        {successo ? '✓' : '×'}
      </div>

      <h1 className={styles.pageTitle}>
        {successo
          ? t('pagamenti.esito.successoTitolo')
          : t('pagamenti.esito.annullatoTitolo')}
      </h1>

      <p className={styles.pageSubtitle}>
        {successo
          ? t('pagamenti.esito.successoTesto')
          : t('pagamenti.esito.annullatoTesto')}
      </p>

      <div className={styles.actions}>
        <Link to={ROUTES.CATALOGO}>
          <Button variant="secondary">{t('pagamenti.esito.tornaCatalogo')}</Button>
        </Link>
        {successo && (
          <Link to={ROUTES.CORSI_STUDENTE}>
            <Button>{t('pagamenti.esito.vaiAiCorsi')}</Button>
          </Link>
        )}
      </div>
    </Card>
  );
};

export default PagamentoEsitoPage;
