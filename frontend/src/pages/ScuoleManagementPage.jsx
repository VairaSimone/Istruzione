import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScuoleList } from '../hooks/useScuole';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import Button from '../components/ui/Button';
import ScuoleList from '../features/scuole/components/ScuoleList';
import ScuolaFormModal from '../features/scuole/components/ScuolaFormModal';
import pageStyles from './UsersManagementPage.module.css';
import styles from '../features/scuole/components/Scuole.module.css';

/**
 * Gestione SCUOLE (solo admin): elenco con conteggi utenti/aule, creazione,
 * modifica (nome + impostazioni JSON) ed eliminazione. Le impostazioni sono
 * personali per ciascuna scuola (multi-tenant).
 */
const ScuoleManagementPage = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [scuolaInModifica, setScuolaInModifica] = useState(null);

  const { data, isLoading, isError, error, refetch } = useScuoleList();

  const apriCreazione = () => {
    setScuolaInModifica(null);
    setModalOpen(true);
  };

  const apriModifica = (scuola) => {
    setScuolaInModifica(scuola);
    setModalOpen(true);
  };

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.intro}>
        <h1 className={pageStyles.title}>{t('scuole.managementTitle')}</h1>
        <p className={pageStyles.subtitle}>{t('scuole.managementSubtitle')}</p>
      </header>

      <div className={styles.formActions}>
        <Button onClick={apriCreazione}>{t('scuole.create.cta')}</Button>
      </div>

      <h2 className={styles.sectionTitle}>{t('scuole.list.title')}</h2>

      <ScuoleList
        scuole={data?.scuole ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={isError ? getApiErrorMessage(t, error) : null}
        onRetry={refetch}
        onEdit={apriModifica}
      />

      <ScuolaFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        scuola={scuolaInModifica}
      />
    </div>
  );
};

export default ScuoleManagementPage;
