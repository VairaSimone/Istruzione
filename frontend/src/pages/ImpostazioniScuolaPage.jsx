import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  useMieImpostazioni,
  useUpdateMieImpostazioni,
} from '../hooks/useImpostazioniScuola';
import { useSchemaImpostazioni, useCatalogoFunzionalita } from '../hooks/useConfig';
import { useAuthStore, selectIsAdmin } from '../store/authStore';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/shared/EmptyState';
import ErrorState from '../components/shared/ErrorState';
import SezioneImpostazioni from '../features/impostazioni/components/SezioneImpostazioni';
import AnteprimaBranding from '../features/impostazioni/components/AnteprimaBranding';
import CertificatoConfigPanel from '../features/certificati/components/CertificatoConfigPanel';
import pageStyles from './UsersManagementPage.module.css';
import styles from '../features/impostazioni/components/Impostazioni.module.css';

/**
 * IMPOSTAZIONI DELLA PROPRIA SCUOLA (insegnante o admin di scuola).
 *
 * Il form NON è scritto a mano: è generato da `GET /api/config/schema`. Il
 * backend descrive sezioni, campi, tipi e default; qui li rendiamo. Aggiungere
 * un'impostazione lato server la fa comparire in questa pagina da sola.
 *
 * Il salvataggio è un MERGE PER SEZIONE (`PATCH /api/scuole/mia/impostazioni`):
 * inviamo solo le sezioni effettivamente toccate. Così due persone che
 * modificano sezioni diverse non si sovrascrivono a vicenda.
 *
 * L'ADMIN di piattaforma non appartiene ad alcuna scuola: per lui questa pagina
 * non ha oggetto e lo diciamo, invece di mostrargli un form vuoto che
 * fallirebbe al salvataggio. Le scuole altrui si configurano da
 * «Gestione scuole».
 */
const ImpostazioniScuolaPage = () => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(selectIsAdmin);

  const impostazioniQuery = useMieImpostazioni();
  const schemaQuery = useSchemaImpostazioni();
  const catalogoFunzionalita = useCatalogoFunzionalita();
  const updateImpostazioni = useUpdateMieImpostazioni();

  /**
   * Lo stato locale contiene SOLO le sezioni modificate, non l'intera bozza.
   *
   * Copiare le impostazioni caricate dentro uno stato con un `useEffect`
   * significherebbe duplicare la sorgente di verità e provocare un render a
   * cascata a ogni refetch. Qui la bozza è DERIVATA: dati del server, con
   * sopra le sezioni toccate. Un refetch aggiorna la base senza cancellare le
   * modifiche in corso, e il salvataggio invia esattamente ciò che è cambiato.
   */
  const [modifiche, setModifiche] = useState({});

  const salvate = impostazioniQuery.data ?? null;

  const bozza = useMemo(
    () => (salvate ? { ...salvate, ...modifiche } : null),
    [salvate, modifiche]
  );

const schema = schemaQuery.data?.schema ?? null;

  const nomiSezioni = useMemo(() => (schema ? Object.keys(schema) : []), [schema]);

  // La sezione `certificato` ha un pannello dedicato (upload logo/firma, corpo
  // con segnaposto, selettori di colore): la escludiamo dalla resa generica.
  const nomiSezioniGeneriche = useMemo(
    () => nomiSezioni.filter((nome) => nome !== 'certificato'),
    [nomiSezioni]
  );
  const haCertificato = nomiSezioni.includes('certificato');

  const aggiornaSezione = (nome, valore) => {
    setModifiche((prec) => ({ ...prec, [nome]: valore }));
  };

  const annulla = () => setModifiche({});

  const salva = async () => {
    const sezioni = Object.keys(modifiche);
    if (sezioni.length === 0) return;

    try {
      await updateImpostazioni.mutateAsync(modifiche);
      setModifiche({});
      toast.success(t('impostazioni.toast.salvate'));
    } catch (err) {
      // Il backend indica la sezione e il campo colpevole nel messaggio
      // (`Impostazioni: aspetto.colorePrimario — …`): lo mostriamo integrale,
      // è più utile di un generico "dati non validi".
      toast.error(getApiErrorMessage(t, err));
    }
  };

  if (isAdmin) {
    return (
      <div className={pageStyles.page}>
        <header className={pageStyles.intro}>
          <h1 className={pageStyles.title}>{t('impostazioni.title')}</h1>
        </header>
        <EmptyState
          title={t('impostazioni.admin.title')}
          description={t('impostazioni.admin.description')}
        />
      </div>
    );
  }

  if (impostazioniQuery.isLoading || schemaQuery.isLoading || !bozza || !schema) {
    return <Spinner size="lg" label={t('common.loading')} />;
  }

  if (impostazioniQuery.isError || schemaQuery.isError) {
    return (
      <ErrorState
        message={getApiErrorMessage(
          t,
          impostazioniQuery.error ?? schemaQuery.error
        )}
        onRetry={() => {
          impostazioniQuery.refetch();
          schemaQuery.refetch();
        }}
      />
    );
  }

  const numeroModifiche = Object.keys(modifiche).length;
  const haModifiche = numeroModifiche > 0;
  const isPending = updateImpostazioni.isPending;

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.intro}>
        <h1 className={pageStyles.title}>{t('impostazioni.title')}</h1>
        <p className={pageStyles.subtitle}>{t('impostazioni.subtitle')}</p>
      </header>

      <AnteprimaBranding impostazioni={bozza} />

      <div className={styles.sezioni}>
        {nomiSezioniGeneriche.map((nome) => (
          <SezioneImpostazioni
            key={nome}
            nome={nome}
            descrittore={schema[nome]}
            valore={bozza[nome]}
            catalogoFunzionalita={catalogoFunzionalita}
            onChange={(valore) => aggiornaSezione(nome, valore)}
          />
        ))}

        {haCertificato && (
          <CertificatoConfigPanel
            valore={bozza.certificato}
            onChange={(valore) => aggiornaSezione('certificato', valore)}
          />
        )}
      </div>

      {/* Barra di salvataggio: compare solo quando c'è qualcosa da salvare, e
          resta ancorata in basso perché il form è lungo. */}
      {haModifiche && (
        <div className={styles.barraSalvataggio} role="status">
          <span className={styles.barraTesto}>
            {t('impostazioni.modifiche', { count: numeroModifiche })}
          </span>
          <div className={styles.barraAzioni}>
            <Button variant="ghost" onClick={annulla} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={salva} isLoading={isPending}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpostazioniScuolaPage;
