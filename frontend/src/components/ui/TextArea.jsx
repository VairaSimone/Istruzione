import { forwardRef, useId } from 'react';
import styles from './TextField.module.css';

/**
 * Area di testo multilinea, coerente con TextField (stessi stili/errore).
 * Registrabile via react-hook-form: `{...register('campo')}`.
 */
const TextArea = forwardRef(({ label, error, hint, rows = 4, required, ...rest }, ref) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        className={[styles.input, error ? styles.inputError : ''].join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      />
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

TextArea.displayName = 'TextArea';

export default TextArea;
