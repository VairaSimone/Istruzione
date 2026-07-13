import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, selectIsAdmin } from '../store/authStore';
import ContattiInbox from '../features/contatti/components/ContattiInbox';
import ScuolaSelect from '../features/scuole/components/ScuolaSelect';
import pageStyles from './UsersManagementPage.module.css';
import styles from '../features/contatti/components/Contatti.module.css';

/**
 * Gestione delle RICHIESTE DI CONTATTO (staff/admin): i lead ricevuti dal form
 * della homepage pubblica.
 *
 * Lo STAFF vede le richieste della propria scuola. L'ADMIN è trasversale: deve
 * prima scegliere una scuola (il backend richiede lo `scuolaId`), poi ne
 * consulta i lead. Finché non ne sceglie una, l'inbox invita a selezionarla.
 */
const ContattiManagementPage = () => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(selectIsAdmin);
  const [scuolaId, setScuolaId] = useState('');

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.intro}>
        <h1 className={pageStyles.title}>{t('contatti.gestione.titolo')}</h1>
        <p className={pageStyles.subtitle}>{t('contatti.gestione.sottotitolo')}</p>
      </header>

      {isAdmin && (
        <div className={styles.toolbarScuola}>
          <ScuolaSelect
            label={t('contatti.gestione.scuola')}
            value={scuolaId}
            onChange={(e) => setScuolaId(e.target.value)}
          />
        </div>
      )}

      <ContattiInbox
        scuolaId={isAdmin ? scuolaId || undefined : undefined}
        attesaScuola={isAdmin && !scuolaId}
      />
    </div>
  );
};

export default ContattiManagementPage;
