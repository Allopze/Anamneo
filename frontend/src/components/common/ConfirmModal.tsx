'use client';

import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

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
    button: 'btn bg-status-yellow text-white hover:bg-status-yellow/80 focus-visible:ring-status-yellow',
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
  const confirmRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button by default for destructive actions
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
                <FiAlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="confirm-title" className="text-lg font-semibold text-ink-primary">
                  {title}
                </h3>
                <p id="confirm-message" className="mt-2 text-sm text-ink-secondary">
                  {message}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                aria-label="Cerrar"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
            <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              className={styles.button}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Procesando…
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
