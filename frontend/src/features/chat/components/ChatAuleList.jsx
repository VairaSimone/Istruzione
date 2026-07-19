import { useTranslation } from 'react-i18next';
import { getActiveLanguage } from '../../../i18n';
import styles from './Chat.module.css';

/**
 * Colonna sinistra della chat: elenco delle aule di cui l'utente è membro, con
 * anteprima dell'ultimo messaggio, orario e badge dei non letti. Selezionare
 * un'aula naviga al suo feed.
 */

const iniziale = (nome) => (nome ? nome.trim().charAt(0).toUpperCase() : '?');

/** Orario compatto: "14:32" se oggi, altrimenti "gg/mm". */
const orarioCompatto = (iso, lang) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const oggi = new Date();
  const stessoGiorno =
    d.getFullYear() === oggi.getFullYear() &&
    d.getMonth() === oggi.getMonth() &&
    d.getDate() === oggi.getDate();
  if (stessoGiorno) {
    return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(lang, { day: '2-digit', month: '2-digit' });
};

const ChatAuleList = ({ aule = [], classeSelezionata, onSeleziona }) => {
  const { t } = useTranslation();
  const lang = getActiveLanguage();

  return (
    <div className={styles.sidebar}>
      <div className={styles.auleHead}>{t('chat.aule.title')}</div>
      <ul className={styles.auleList}>
        {aule.map((aula) => {
          const attiva = String(aula.id) === String(classeSelezionata);
          const anteprima = aula.ultimoMessaggio
            ? aula.ultimoMessaggio.mittente
              ? `${aula.ultimoMessaggio.mittente.nome}: ${aula.ultimoMessaggio.anteprima}`
              : aula.ultimoMessaggio.anteprima
            : t('chat.aule.nessunMessaggio');

          return (
            <li key={aula.id}>
              <button
                type="button"
                className={[styles.aulaItem, attiva ? styles.aulaItemActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSeleziona(aula.id)}
                aria-current={attiva ? 'true' : undefined}
                title={aula.nome}
              >
                <span
                  className={styles.aulaDot}
                  style={aula.colore ? { background: aula.colore } : undefined}
                  aria-hidden="true"
                >
                  {iniziale(aula.nome)}
                </span>
                <span className={styles.aulaBody}>
                  <span className={styles.aulaNome}>
                    <span className={styles.aulaNomeTesto}>{aula.nome}</span>
                    {aula.ultimoMessaggio && (
                      <span className={styles.aulaOrario}>
                        {orarioCompatto(aula.ultimoMessaggio.created_at, lang)}
                      </span>
                    )}
                  </span>
                  <span className={styles.aulaAnteprima}>
                    {aula.ultimoMessaggio?.haAllegato ? `📎 ${anteprima}` : anteprima}
                  </span>
                </span>
                {aula.nonLetti > 0 && (
                  <span
                    className={styles.aulaBadge}
                    aria-label={t('chat.unreadAria', { n: aula.nonLetti })}
                  >
                    {aula.nonLetti > 99 ? '99+' : aula.nonLetti}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ChatAuleList;
