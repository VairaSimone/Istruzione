import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../../../components/ui/Button';
import { ACCEPT_TUTTI, tipoPerMime, validaFile } from '../../../constants/upload';
import styles from './Chat.module.css';

/**
 * Barra di composizione della chat: testo + allegato facoltativo.
 *
 * Invio con Invio (a capo con Maiusc+Invio). Il file è validato lato client
 * (tipo e dimensione) solo per un feedback immediato: la validazione autorevole
 * resta nel backend. Il testo/allegato si azzerano solo a invio riuscito.
 */
const ChatComposer = ({ onInvia, invioInCorso }) => {
  const { t } = useTranslation();
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState(null);
  const [tipo, setTipo] = useState(null);
  const inputFileRef = useRef(null);

  const handleFile = (evento) => {
    const scelto = evento.target.files?.[0];
    // Consente di riselezionare lo stesso file dopo una rimozione.
    evento.target.value = '';
    if (!scelto) return;

    const tipoFile = tipoPerMime(scelto.type);
    if (!tipoFile) {
      toast.error(t('upload.errors.tipo'));
      return;
    }
    const errore = validaFile(tipoFile, scelto);
    if (errore) {
      toast.error(t(errore.key, errore.params));
      return;
    }
    setFile(scelto);
    setTipo(tipoFile);
  };

  const rimuoviFile = () => {
    setFile(null);
    setTipo(null);
  };

  const handleInvia = async () => {
    const testoTrim = testo.trim();
    if (!testoTrim && !file) return;
    try {
      await onInvia({ corpo: testoTrim, file, tipo });
      setTesto('');
      setFile(null);
      setTipo(null);
    } catch {
      // Il messaggio d'errore lo mostra il chiamante: qui NON azzeriamo, così
      // l'utente non perde ciò che aveva scritto.
    }
  };

  const handleKeyDown = (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      handleInvia();
    }
  };

  const puoInviare = (testo.trim() !== '' || Boolean(file)) && !invioInCorso;

  return (
    <div className={styles.composer}>
      {file && (
        <div className={styles.allegatoChip}>
          <span aria-hidden="true">📎</span>
          <span className={styles.allegatoChipNome}>{file.name}</span>
          <button
            type="button"
            className={styles.allegatoChipRimuovi}
            onClick={rimuoviFile}
            aria-label={t('chat.composer.rimuoviAllegato')}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.composerRiga}>
        <button
          type="button"
          className={styles.allegaBtn}
          onClick={() => inputFileRef.current?.click()}
          aria-label={t('chat.composer.allega')}
          title={t('chat.composer.allega')}
          disabled={invioInCorso}
        >
          📎
        </button>
        <input
          ref={inputFileRef}
          type="file"
          className={styles.visuallyHidden}
          accept={ACCEPT_TUTTI}
          onChange={handleFile}
          tabIndex={-1}
        />

        <textarea
          className={styles.composerInput}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.composer.placeholder')}
          rows={1}
          aria-label={t('chat.composer.placeholder')}
        />

        <Button onClick={handleInvia} disabled={!puoInviare} isLoading={invioInCorso}>
          {t('chat.composer.invia')}
        </Button>
      </div>
    </div>
  );
};

export default ChatComposer;
