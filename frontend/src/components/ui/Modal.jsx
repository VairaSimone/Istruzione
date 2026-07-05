import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Modal.module.css';

/**
 * Modal accessibile riutilizzabile.
 *
 * - chiusura con Esc e con click sull'overlay;
 * - blocca lo scroll del body mentre è aperto;
 * - `role="dialog"` + `aria-modal` + `aria-labelledby`.
 *
 * La logica (cosa mostrare, cosa fare alla conferma) resta nel chiamante:
 * il Modal è solo il contenitore visivo. Il footer è opzionale.
 */
const Modal = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={[styles.dialog, styles[size]].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
