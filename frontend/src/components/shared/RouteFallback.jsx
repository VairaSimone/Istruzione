import Spinner from '../ui/Spinner';
import styles from './RouteFallback.module.css';

/**
 * Fallback mostrato da <Suspense> mentre il chunk di una route caricata in
 * modo lazy viene scaricato. Occupa l'area contenuti (non l'intero schermo):
 * Header e Footer, che sono nello shell eager, restano visibili e stabili.
 */
const RouteFallback = () => (
  <div className={styles.wrapper}>
    <Spinner size="lg" />
  </div>
);

export default RouteFallback;
