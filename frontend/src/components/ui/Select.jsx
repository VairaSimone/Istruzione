import { forwardRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TextField.module.css';

/**
 * Select per campi enum (classe, ruolo, lingua...). Riusa volutamente gli
 * stessi stili di TextField per coerenza visiva tra i campi del form.
 */
const Select = forwardRef(
  ({ label, error, required, children, placeholder, ...rest }, ref) => {
    const { t } = useTranslation();
    const id = useId();
    const errorId = `${id}-error`;
    // In modalità controllata (value fornito) NON impostare defaultValue, per
    // evitare l'avviso React "controlled/uncontrolled". Con react-hook-form
    // (uncontrolled, via ref) si mantiene defaultValue="" per mostrare il
    // placeholder finché il campo non è valorizzato.
    const isControlled = rest.value !== undefined;

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
          {...(isControlled ? {} : { defaultValue: '' })}
          {...rest}
        >
          <option value="" disabled>
            {placeholder || t('common.selectPlaceholder')}
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
