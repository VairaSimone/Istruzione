import styles from './Card.module.css';

/**
 * Contenitore visivo di base per blocchi di contenuto (form, sezioni
 * dashboard, righe utente...). Singola responsabilità: superficie coerente
 * (padding + bordo + shadow) in tutta l'app.
 *
 * Props (tutte opzionali, retro-compatibili):
 * - as:          elemento/componente da renderizzare (default 'div')
 * - interactive: abilita hover-lift + cursore (per card cliccabili)
 * - padding:     'none' | 'sm' | 'md' (default) | 'lg'
 * - className:   classi aggiuntive del chiamante
 */
const Card = ({
  children,
  className = '',
  as: Component = 'div',
  interactive = false,
  padding = 'md',
  ...rest
}) => {
  return (
    <Component
      className={[
        styles.card,
        styles[`pad-${padding}`],
        interactive ? styles.interactive : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Component>
  );
};

export default Card;
