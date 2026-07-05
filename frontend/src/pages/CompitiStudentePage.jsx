import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompitiStudente } from '../hooks/useCompiti';
import { STATI_COMPITO_STUDENTE } from '../constants/domain';
import CompitoStudenteCard from '../features/compiti/components/CompitoStudenteCard';
import Spinner from '../components/ui/Spinner';
import styles from '../features/compiti/components/Compiti.module.css';

/** Elenco dei compiti dello studente, filtrabile per stato. */
const CompitiStudentePage = () => {
  const { t } = useTranslation();
  const [stato, setStato] = useState('');

  const { data, isLoading, isError } = useCompitiStudente(stato ? { stato } : {});
  const compiti = data?.compiti ?? [];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('compiti.studente.title')}</h1>
          <p className={styles.pageSubtitle}>{t('compiti.studente.subtitle')}</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, stato === '' ? styles.tabActive : ''].join(' ')}
          onClick={() => setStato('')}
        >
          {t('compiti.studente.all')}
        </button>
        {STATI_COMPITO_STUDENTE.map((s) => (
          <button
            key={s}
            type="button"
            className={[styles.tab, stato === s ? styles.tabActive : ''].join(' ')}
            onClick={() => setStato(s)}
          >
            {t(`compiti.statiStudente.${s}`)}
          </button>
        ))}
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('compiti.studente.loadError')}</p>}

      {!isLoading && !isError && compiti.length === 0 && (
        <p className={styles.emptyText}>{t('compiti.studente.empty')}</p>
      )}

      {compiti.length > 0 && (
        <div className={styles.grid}>
          {compiti.map((compito) => (
            <CompitoStudenteCard key={compito.id} compito={compito} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CompitiStudentePage;
