import styles from './Badge.module.css';

/**
 * Badge per etichette di stato brevi: ruolo utente, stato verifica email,
 * classe. `tone` determina il colore semantico.
 */
const Badge = ({ children, tone = 'neutral' }) => {
  return <span className={[styles.badge, styles[tone]].join(' ')}>{children}</span>;
};

export default Badge;
