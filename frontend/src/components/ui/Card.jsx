import styles from './Card.module.css';

/**
 * Contenitore visivo di base per blocchi di contenuto (form, sezioni
 * dashboard, righe utente...). Singola responsabilità: padding + bordo +
 * leggero shadow coerente in tutta l'app.
 */
const Card = ({ children, className = '', as: Component = 'div', ...rest }) => {
  return (
    <Component className={[styles.card, className].join(' ')} {...rest}>
      {children}
    </Component>
  );
};

export default Card;
