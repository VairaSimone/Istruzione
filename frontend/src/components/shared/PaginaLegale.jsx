import { useTranslation } from 'react-i18next';
import styles from './PaginaLegale.module.css';

/**
 * Impaginazione condivisa delle pagine legali (Privacy, Cookie, Termini,
 * Accessibilità). Riceve un contenuto strutturato — titolo, versione/data e un
 * elenco di sezioni { titolo, paragrafi } — e lo rende in un articolo leggibile
 * e accessibile (un solo <h1>, sezioni con <h2>).
 *
 * `children` opzionale viene reso in coda alle sezioni (es. il blocco di
 * segnalazione barriere nella Dichiarazione di accessibilità).
 */
const PaginaLegale = ({ contenuto, children }) => {
  const { t } = useTranslation();
  if (!contenuto) return null;

  const { titolo, aggiornamento, sezioni = [] } = contenuto;

  return (
    <div className={styles.wrapper}>
      <article className={styles.article} aria-labelledby="titolo-pagina-legale">
        <header className={styles.header}>
          <h1 id="titolo-pagina-legale" className={styles.title}>
            {titolo}
          </h1>
          {aggiornamento && (
            <p className={styles.meta}>
              {t('legale.aggiornamento', { versione: aggiornamento })}
            </p>
          )}
        </header>

        {sezioni.map((sezione, i) => (
          <section key={i} className={styles.section}>
            {sezione.titolo && <h2 className={styles.sectionTitle}>{sezione.titolo}</h2>}
            {(sezione.paragrafi || []).map((testo, j) => (
              <p key={j} className={styles.paragraph}>
                {testo}
              </p>
            ))}
          </section>
        ))}

        {children}
      </article>
    </div>
  );
};

export default PaginaLegale;
