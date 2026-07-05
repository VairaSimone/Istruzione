import Card from '../../../components/ui/Card';
import styles from './Dashboard.module.css';

/**
 * Lista ordinata riutilizzabile (top-N).
 * `items`: [{ id?, label (nodo), right (nodo) }]. `label`/`right` possono
 * essere stringhe o elementi (es. un carattere giapponese in evidenza).
 */
const RankingList = ({ title, items = [], emptyText }) => (
  <Card>
    <h3 className={styles.panelTitle}>{title}</h3>
    {items.length === 0 ? (
      <p className={styles.emptyText}>{emptyText}</p>
    ) : (
      <ol className={styles.rankList}>
        {items.map((it, i) => (
          <li key={it.id ?? i} className={styles.rankRow}>
            <span className={styles.rankNum}>{i + 1}</span>
            <span className={styles.rankLabel}>{it.label}</span>
            {it.right != null && <span className={styles.rankRight}>{it.right}</span>}
          </li>
        ))}
      </ol>
    )}
  </Card>
);

export default RankingList;
