import { forwardRef, useId } from 'react';
import styles from './TextField.module.css';

/**
 * Select per campi enum (classe, ruolo, lingua...). Riusa volutamente gli
 * stessi stili di TextField per coerenza visiva tra i campi del form.
 */
const Select = forwardRef(
  ({ label, error, required, children, placeholder, ...rest }, ref) => {
    const id = useId();
    const errorId = `${id}-error`;

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
        <select
          id={id}
          ref={ref}
          className={[styles.input, error ? styles.inputError : ''].join(' ')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          defaultValue=""
          {...rest}
        >
          <option value="" disabled>
            {placeholder || 'Seleziona…'}
          </option>
          {children}
        </select>
        {error && (
          <span id={errorId} className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
