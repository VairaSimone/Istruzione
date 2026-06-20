import styles from './Skeleton.module.css';

/**
 * Skeleton generico. `variant` controlla la forma (linea di testo, blocco,
 * cerchio per avatar). Usato al posto di spinner quando la UI finale ha
 * una struttura nota (es. righe di tabella, card profilo) per ridurre il
 * "layout shift" percepito quando i dati arrivano.
 */
const Skeleton = ({ variant = 'text', width, height, className = '' }) => {
  const style = {
    width: width ?? undefined,
    height: height ?? undefined,
  };

  return (
    <span
      className={[styles.skeleton, styles[variant], className].join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
