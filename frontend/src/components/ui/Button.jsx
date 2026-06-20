import { forwardRef } from 'react';
import styles from './Button.module.css';

/**
 * Button riutilizzabile. Singola responsabilità: rendering visivo + stati
 * (loading, disabled). La logica di business (cosa succede al click)
 * resta sempre nel chiamante.
 */
const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      type = 'button',
      fullWidth = false,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={[
          styles.button,
          styles[variant],
          styles[size],
          fullWidth ? styles.fullWidth : '',
        ].join(' ')}
        aria-busy={isLoading}
        {...rest}
      >
        {isLoading && <span className={styles.spinner} aria-hidden="true" />}
        <span className={isLoading ? styles.labelLoading : undefined}>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
