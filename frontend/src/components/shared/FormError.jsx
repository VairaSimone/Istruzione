import styles from './FormError.module.css';

/**
 * Banner di errore a livello di form, per errori che non sono legati a
 * un singolo campo (es. "Credenziali non valide", "Account bloccato per
 * troppi tentativi"). Gli errori per-campo vivono invece dentro TextField.
 */
const FormError = ({ message }) => {
  if (!message) return null;

  return (
    <div className={styles.banner} role="alert">
      {message}
    </div>
  );
};

export default FormError;
