import { useTranslation } from 'react-i18next';
import { useMiaQuota } from '../../../hooks/useScuole';
import Spinner from '../../../components/ui/Spinner';
import QuotaBars from './QuotaBars';
import styles from './QuotaBars.module.css';

/**
 * QuotaScuolaPanel — pannello a SOLA LETTURA con l'occupazione quota della
 * PROPRIA scuola, mostrato nella pagina «Impostazioni scuola».
 *
 * Lo staff vede quanto spazio e quanti posti (utenti/insegnanti) sta usando, ma
 * NON può modificare i limiti: quelli li assegna l'admin dalla gestione scuole.
 * Se la scuola non ha limiti impostati le barre mostrano «Illimitato».
 */
const QuotaScuolaPanel = () => {
  const { t } = useTranslation();
  const { data: quota, isLoading, isError } = useMiaQuota();

  // In errore o senza dati il pannello si nasconde: non è un blocco critico.
  if (isError) return null;

  return (
    <section className={styles.panel} aria-label={t('scuole.quota.title')}>
      <h2 className={styles.panelTitle}>{t('scuole.quota.title')}</h2>
      <p className={styles.panelHint}>{t('scuole.quota.hint')}</p>
      {isLoading || !quota ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <QuotaBars quota={quota} />
      )}
    </section>
  );
};

export default QuotaScuolaPanel;
