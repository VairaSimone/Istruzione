import styles from './EmptyState.module.css';

/**
 * Stato vuoto generico.
 *
 * Il segno mostrato è un glifo NEUTRO (un cerchio spezzato), non un ideogramma:
 * la piattaforma è generica e non deve suggerire una materia in ogni angolo
 * dell'interfaccia.
 */
const EmptyState = ({ title, description, action }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.mark} aria-hidden="true">
        ○
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};

export default EmptyState;
