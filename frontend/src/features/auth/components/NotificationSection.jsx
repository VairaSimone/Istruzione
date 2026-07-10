import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../../hooks/useProfileMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import styles from './NotificationSection.module.css';

/**
 * Categorie di notifica email mostrate come toggle. L'ordine e le chiavi
 * rispecchiano le categorie del backend (`constants/tipiNotifica.js`):
 * messaggi · compiti · scadenze · feedback. Aggiungere una categoria qui (e la
 * relativa chiave i18n) la fa comparire nel pannello; il backend ignora le
 * chiavi che non conosce, quindi i due lati restano indipendenti.
 */
const CATEGORIE = ['messaggi', 'compiti', 'scadenze', 'feedback'];

/**
 * Sezione "Notifiche email" nel profilo.
 *
 * Espone due livelli di controllo, coerenti col backend:
 *   1. un INTERRUTTORE GENERALE (`emailAttive`): se spento, l'utente non riceve
 *      alcuna email di notifica e i toggle di categoria vengono disabilitati;
 *   2. un TOGGLE PER CATEGORIA (messaggi, compiti, scadenze, feedback).
 *
 * Le preferenze sono lette da GET /me/notifiche (blob già completo dei default)
 * e salvate con PATCH /me/notifiche. Lo stato locale permette all'utente di
 * modificare più toggle e salvare in un colpo solo; "Salva" è attivo solo se
 * c'è una modifica pendente.
 */
const NotificationSection = () => {
  const { t } = useTranslation();
  const { data: preferenze, isLoading, isError, error } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Bozza locale modificabile dai toggle. Anziché sincronizzarla via useEffect
  // (che l'ESLint del progetto scoraggia), la si inizializza pigramente e la si
  // RESETTA quando cambiano i dati del server, confrontando lo "snapshot" da cui
  // la bozza corrente è stata derivata. È il pattern "derived state on prop
  // change" senza effetti: nessun render a cascata.
  const [bozza, setBozza] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  if (preferenze && preferenze !== snapshot) {
    setSnapshot(preferenze);
    setBozza({
      emailAttive: preferenze.emailAttive !== false,
      categorie: { ...preferenze.categorie },
    });
  }

  if (isLoading || !bozza) {
    return (
      <Card>
        <h2 className={styles.sectionTitle}>{t('notifications.title')}</h2>
        <div className={styles.loading}>
          <Spinner />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <h2 className={styles.sectionTitle}>{t('notifications.title')}</h2>
        <p className={styles.errorText}>{getApiErrorMessage(t, error)}</p>
      </Card>
    );
  }

  const categoriaAttiva = (chiave) => bozza.categorie?.[chiave] !== false;

  const toggleGenerale = () => {
    setBozza((prev) => ({ ...prev, emailAttive: !prev.emailAttive }));
  };

  const toggleCategoria = (chiave) => {
    setBozza((prev) => ({
      ...prev,
      categorie: { ...prev.categorie, [chiave]: !categoriaAttiva(chiave) },
    }));
  };

  // C'è qualcosa da salvare?
  const modificato =
    preferenze &&
    (bozza.emailAttive !== (preferenze.emailAttive !== false) ||
      CATEGORIE.some(
        (c) => (bozza.categorie?.[c] !== false) !== (preferenze.categorie?.[c] !== false)
      ));

  const onSalva = async () => {
    try {
      await updateMutation.mutateAsync({
        emailAttive: bozza.emailAttive,
        categorie: bozza.categorie,
      });
      toast.success(t('notifications.updated'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>{t('notifications.title')}</h2>
      <p className={styles.sectionDescription}>{t('notifications.description')}</p>

      {/* Interruttore generale */}
      <label className={`${styles.toggleRiga} ${styles.toggleGenerale}`}>
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={bozza.emailAttive}
          onChange={toggleGenerale}
        />
        <span className={styles.toggleTesto}>
          <span className={styles.toggleTitolo}>{t('notifications.master.title')}</span>
          <span className={styles.toggleDescrizione}>
            {t('notifications.master.description')}
          </span>
        </span>
      </label>

      {/* Toggle per categoria (disabilitati se l'interruttore generale è spento) */}
      <ul className={styles.toggleList}>
        {CATEGORIE.map((chiave) => {
          const disabilitata = !bozza.emailAttive;
          return (
            <li key={chiave} className={styles.toggleRiga}>
              <label
                className={`${styles.toggleLabel} ${disabilitata ? styles.disabilitata : ''}`}
              >
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={bozza.emailAttive && categoriaAttiva(chiave)}
                  disabled={disabilitata}
                  onChange={() => toggleCategoria(chiave)}
                />
                <span className={styles.toggleTesto}>
                  <span className={styles.toggleTitolo}>
                    {t(`notifications.categorie.${chiave}.title`)}
                  </span>
                  <span className={styles.toggleDescrizione}>
                    {t(`notifications.categorie.${chiave}.description`)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <Button
          type="button"
          onClick={onSalva}
          isLoading={updateMutation.isPending}
          disabled={!modificato}
        >
          {t('notifications.save')}
        </Button>
      </div>
    </Card>
  );
};

export default NotificationSection;
