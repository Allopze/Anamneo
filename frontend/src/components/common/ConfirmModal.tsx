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
    icon: 'bg-red-100 text-red-600',
    button: 'btn btn-danger',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-600',
    button: 'btn bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
  },
  info: {
    icon: 'bg-primary-100 text-primary-600',
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
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
                <FiAlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="confirm-title" className="text-lg font-semibold text-slate-900">
                  {title}
                </h3>
                <p id="confirm-message" className="mt-2 text-sm text-slate-600">
                  {message}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-xl border-t border-slate-200">
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
                  Procesando...
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
