import { forwardRef, useId } from 'react';
import styles from './Checkbox.module.css';

/**
 * Checkbox controllato, pensato per react-hook-form: `{...register('campo')}`.
 * L'etichetta può essere testo o nodi React (es. link a pagine legali).
 *
 * Accessibilità: label associata via `htmlFor`, stato d'errore esposto con
 * `aria-invalid` e `aria-describedby`, messaggio d'errore con `role="alert"`.
 */
const Checkbox = forwardRef(({ label, error, hint, required, ...rest }, ref) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <input
          id={id}
          ref={ref}
          type="checkbox"
          className={[styles.input, error ? styles.inputError : ''].join(' ')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...rest}
        />
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      </div>
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
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
