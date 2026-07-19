import { useTranslation } from 'react-i18next';
import { chatFileUrl, formatBytes } from '../../../utils/fileUrl';
import { getActiveLanguage } from '../../../i18n';
import styles from './Chat.module.css';

/**
 * Una bolla di messaggio nel feed della chat.
 *
 * Allineata a destra se è dell'utente corrente, a sinistra altrimenti (con il
 * nome dell'autore e, per lo staff, un tag di ruolo). Gli allegati immagine
 * sono mostrati in anteprima; gli altri come scheda scaricabile. Un messaggio
 * eliminato mostra un segnaposto, senza testo né allegato.
 */

const oraDi = (iso, lang) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
};

const ChatMessaggio = ({ messaggio, mia, classeId, puoEliminare, onElimina }) => {
  const { t } = useTranslation();
  const lang = getActiveLanguage();

  const autore = messaggio.mittente;
  const nomeAutore = autore
    ? `${autore.nome ?? ''} ${autore.cognome ?? ''}`.trim() || t('chat.utenteRimosso')
    : t('chat.utenteRimosso');
  const mostraRuoloTag = autore && autore.ruolo === 'insegnante';

  const allegato = messaggio.allegato;
  const urlAllegato = allegato ? chatFileUrl(classeId, allegato.id) : null;

  return (
    <div className={[styles.riga, mia ? styles.rigaMia : styles.rigaAltrui].join(' ')}>
      {!mia && !messaggio.eliminato && (
        <span className={styles.autore}>
          {nomeAutore}
          {mostraRuoloTag && <span className={styles.ruoloTag}>{t('chat.ruoloInsegnante')}</span>}
        </span>
      )}

      <div
        className={[
          styles.bolla,
          mia ? styles.bollaMia : '',
          messaggio.eliminato ? styles.bollaEliminata : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {messaggio.eliminato ? (
          <p className={styles.testo}>{t('chat.messaggioEliminato')}</p>
        ) : (
          <>
            {messaggio.corpo && <p className={styles.testo}>{messaggio.corpo}</p>}

            {allegato && allegato.tipo === 'immagine' && urlAllegato && (
              <a href={urlAllegato} target="_blank" rel="noopener noreferrer">
                <img
                  className={styles.allegatoImg}
                  src={urlAllegato}
                  alt={allegato.nomeOriginale || t('chat.allegato')}
                  loading="lazy"
                />
              </a>
            )}

            {allegato && allegato.tipo !== 'immagine' && urlAllegato && (
              <a
                className={styles.allegatoFile}
                href={urlAllegato}
                target="_blank"
                rel="noopener noreferrer"
                download={allegato.nomeOriginale || undefined}
              >
                <span className={styles.allegatoIcona} aria-hidden="true">
                  {allegato.tipo === 'video' ? '🎬' : '📄'}
                </span>
                <span className={styles.allegatoInfo}>
                  <span className={styles.allegatoNome}>
                    {allegato.nomeOriginale || t('chat.allegato')}
                  </span>
                  <span className={styles.allegatoMeta}>{formatBytes(allegato.dimensioneByte)}</span>
                </span>
              </a>
            )}
          </>
        )}
      </div>

      <span className={styles.orario}>
        {oraDi(messaggio.created_at, lang)}
        {puoEliminare && !messaggio.eliminato && (
          <>
            {' '}
            <button
              type="button"
              className={styles.eliminaBtn}
              onClick={() => onElimina(messaggio)}
              aria-label={t('chat.eliminaMessaggio')}
              title={t('chat.eliminaMessaggio')}
            >
              🗑
            </button>
          </>
        )}
      </span>
    </div>
  );
};

export default ChatMessaggio;
