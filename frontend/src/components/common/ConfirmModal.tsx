'use client';

import { useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { Dialog } from './Dialog';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantStyles = {
  danger: {
    icon: 'bg-status-red/20 text-status-red',
    button: 'btn btn-danger',
  },
  warning: {
    icon: 'border border-status-yellow/65 bg-status-yellow/35 text-accent-text',
    button: 'btn bg-status-yellow text-accent-text hover:brightness-95 focus-visible:ring-status-yellow',
  },
  info: {
    icon: 'border border-status-yellow/65 bg-status-yellow/35 text-accent-text',
    button: 'btn btn-primary',
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      role="alertdialog"
      title={title}
      description={message}
      initialFocusRef={cancelRef}
      loading={loading}
      maxWidth="md"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
            <FiAlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-ink-primary">{title}</h3>
            <p className="mt-2 text-sm text-ink-secondary">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
            aria-label="Cerrar"
            disabled={loading}
          >
            <FiX className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
        <button ref={cancelRef} onClick={onClose} className="btn btn-secondary" disabled={loading}>
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={styles.button}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true" />
              Procesando…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Dialog>
  );
}
