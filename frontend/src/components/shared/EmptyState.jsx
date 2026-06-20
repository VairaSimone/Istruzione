import styles from './EmptyState.module.css';

/**
 * Stato vuoto per liste senza risultati (es. nessun utente trovato con i
 * filtri correnti). Non lascia mai una tabella/lista "silenziosamente
 * vuota": spiega cosa è successo e, quando ha senso, suggerisce un'azione.
 */
const EmptyState = ({ title, description, action }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.mark} aria-hidden="true">
        印
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};

export default EmptyState;
