'use client';

import { useState } from 'react';
import { FiLock, FiShield, FiX } from 'react-icons/fi';

interface SignEncounterModalProps {
  open: boolean;
  loading: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export default function SignEncounterModal({ open, loading, onConfirm, onClose }: SignEncounterModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Debe ingresar su contraseña para firmar');
      return;
    }
    setError('');
    onConfirm(password);
  };

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="relative mx-4 w-full max-w-md rounded-card border border-frame/10 bg-surface-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-md p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <FiShield className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">Firma Electrónica Simple</h2>
            <p className="text-sm text-ink-secondary">Confirme su identidad para firmar</p>
          </div>
        </div>

        <div className="mb-5 rounded-card border border-status-yellow/50 bg-status-yellow/20 p-3 text-sm text-accent-text">
          <p>
            Al firmar esta atención, certifica la veracidad del contenido clínico registrado.
            Este acto es <strong>irreversible</strong> y quedará registrado en la auditoría.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="sign-password" className="form-label">
            Contraseña de su cuenta
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input
              id="sign-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              disabled={loading}
              placeholder="Ingrese su contraseña"
              className={`form-input pl-10 ${error ? 'form-input-error' : ''}`}
              autoFocus
            />
          </div>
          {error && (
            <p className="form-error mt-1" role="alert">{error}</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-input border border-frame/15 bg-surface-elevated px-4 py-2.5 text-sm font-medium text-ink shadow-soft transition-colors hover:bg-surface-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="inline-flex items-center gap-2 rounded-input border border-accent/70 bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text shadow-soft transition-colors hover:bg-accent-bright disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Firmando…
                </>
              ) : (
                <>
                  <FiShield className="h-4 w-4" />
                  Firmar Atención
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
