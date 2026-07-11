import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVerificaCertificato } from '../hooks/useCertificati';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { formatDate } from '../utils/datetime';
import Card from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import styles from '../features/certificati/components/Certificati.module.css';

/**
 * Verifica PUBBLICA di un certificato tramite codice. Accessibile senza login:
 * chiunque abbia il codice (stampato sul PDF) può confermarne l'autenticità.
 *
 * Il codice può arrivare dall'URL (`/verifica-certificato/:codice`, es. da un
 * QR o un link) oppure essere digitato. La risposta espone solo dati non
 * sensibili (stato, nome, percorso, scuola, date).
 */
const VerificaCertificatoPage = () => {
  const { t, i18n } = useTranslation();
  const { codice: codiceUrl } = useParams();

  // Codice digitato nel campo (inizializzato dall'eventuale codice in URL).
  const [codiceInput, setCodiceInput] = useState(codiceUrl ?? '');
  // Ricerca manuale: `null` finché l'utente non invia il form. In sua assenza
  // vale il codice dell'URL. Nessun `useEffect`: lo stato cercato è DERIVATO.
  const [codiceManuale, setCodiceManuale] = useState(null);

  const codiceCercato = codiceManuale ?? codiceUrl ?? '';

  const { data, isFetching, isError, error } = useVerificaCertificato(codiceCercato);

  const submit = (e) => {
    e.preventDefault();
    setCodiceManuale(codiceInput.trim().toUpperCase());
  };

  const revocato = data?.stato === 'revocato';

  const righe = data
    ? [
        ['nomeStudente', data.nomeStudente],
        ['nomeCorso', data.nomeCorso],
        ['esito', data.esito],
        ['scuola', data.scuola],
        ['dataCompletamento', formatDate(data.dataCompletamento, i18n.language)],
        ['dataRilascio', formatDate(data.dataRilascio, i18n.language)],
      ].filter(([, v]) => v)
    : [];

  return (
    <div className={styles.verificaWrapper}>
      <div>
        <h1 className={styles.pageTitle}>{t('certificati.verifica.title')}</h1>
        <p className={styles.pageSubtitle}>{t('certificati.verifica.subtitle')}</p>
      </div>

      <form className={styles.verificaForm} onSubmit={submit} noValidate>
        <TextField
          label={t('certificati.verifica.codiceLabel')}
          placeholder="CERT-XXXX-XXXX-XXXX"
          value={codiceInput}
          onChange={(e) => setCodiceInput(e.target.value)}
        />
        <Button type="submit" disabled={!codiceInput.trim()} isLoading={isFetching}>
          {t('certificati.verifica.submit')}
        </Button>
      </form>

      {isFetching && <Spinner size="lg" />}

      {!isFetching && codiceCercato && isError && (
        <Card>
          <div className={[styles.statoBanner, styles.statoRevocato].join(' ')}>
            {getApiErrorMessage(t, error)}
          </div>
        </Card>
      )}

      {!isFetching && data && (
        <Card>
          <div className={styles.esitoValido}>
            <div
              className={[
                styles.statoBanner,
                revocato ? styles.statoRevocato : styles.statoValido,
              ].join(' ')}
            >
              <strong>
                {revocato
                  ? t('certificati.verifica.revocato')
                  : t('certificati.verifica.valido')}
              </strong>
            </div>

            <h2 className={styles.cardTitle}>{data.titolo}</h2>

            {righe.map(([chiave, valore]) => (
              <div key={chiave} className={styles.esitoRiga}>
                <span className={styles.esitoEtichetta}>
                  {t(`certificati.verifica.campi.${chiave}`)}
                </span>
                <span className={styles.esitoValore}>{valore}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default VerificaCertificatoPage;
