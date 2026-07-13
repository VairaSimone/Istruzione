import { forwardRef, useId } from 'react';
import styles from './TextField.module.css';

/**
 * Campo di testo controllato, pensato per essere registrato via
 * react-hook-form: `{...register('campo')}`. Mostra l'errore di
 * validazione (client-side Zod o server-side, tramite `error`) sotto
 * il campo, con `aria-invalid` e `aria-describedby` per l'accessibilità.
 */
const TextField = forwardRef(
  ({ label, error, hint, type = 'text', required, multiline = false, rows = 4, ...rest }, ref) => {
    const id = useId();
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const controlloComune = {
      id,
      ref,
      className: [styles.input, error ? styles.inputError : ''].join(' '),
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? errorId : hint ? hintId : undefined,
      ...rest,
    };

    return (
      <div className={styles.field}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {multiline ? (
          <textarea {...controlloComune} rows={rows} />
        ) : (
          <input {...controlloComune} type={type} />
        )}
        {hint && !error && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
        {error && (
          <span id={errorId} className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;
