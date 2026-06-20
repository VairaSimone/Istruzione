import styles from './Spinner.module.css';

const Spinner = ({ size = 'md', label = 'Caricamento in corso' }) => {
  return (
    <div className={styles.wrapper} role="status">
      <span className={[styles.spinner, styles[size]].join(' ')} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
};

export default Spinner;
