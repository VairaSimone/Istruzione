import Card from '../../../components/ui/Card';
import styles from './Dashboard.module.css';

/** Blocco statistico compatto: valore grande + etichetta. */
const StatCard = ({ value, label, suffix = '' }) => (
  <Card className={styles.statCard}>
    <span className={styles.statValue}>
      {value}
      {suffix}
    </span>
    <span className={styles.statLabel}>{label}</span>
  </Card>
);

export default StatCard;
