import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Card from '../ui/Card';
import styles from './ConfirmDialog.module.css';

/**
 * Dialog di conferma generico per azioni irreversibili. Gestisce focus
 * minimo (focus sul bottone di conferma all'apertura) e chiusura via Escape.
 */
const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  onConfirm,
  onCancel,
  tone = 'danger',
}) => {
  const { t } = useTranslation();
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <Card
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <Button
            ref={confirmButtonRef}
            variant={tone}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
