'use client';

import { useEffect, useState } from 'react';
import { FiEdit3, FiX } from 'react-icons/fi';
import {
  ENCOUNTER_REOPEN_REASON_CODES,
  ENCOUNTER_REOPEN_REASON_LABELS,
  type EncounterReopenReasonCode,
} from '../../../../shared/encounter-reopen-reasons';
import { WORKFLOW_NOTE_MIN_LENGTH } from '@/lib/encounter-completion';

interface ReopenEncounterModalProps {
  open: boolean;
  loading: boolean;
  onConfirm: (payload: { reasonCode: EncounterReopenReasonCode; note: string }) => void;
  onClose: () => void;
}

const DEFAULT_REASON_CODE: EncounterReopenReasonCode = 'CORRECCION_CLINICA';

export default function ReopenEncounterModal({
  open,
  loading,
  onConfirm,
  onClose,
}: ReopenEncounterModalProps) {
  const [reasonCode, setReasonCode] = useState<EncounterReopenReasonCode>(DEFAULT_REASON_CODE);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setReasonCode(DEFAULT_REASON_CODE);
      setNote('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (note.trim().length < WORKFLOW_NOTE_MIN_LENGTH) {
      setError(`La nota de reapertura debe tener al menos ${WORKFLOW_NOTE_MIN_LENGTH} caracteres`);
      return;
    }

    setError('');
    onConfirm({
      reasonCode,
      note: note.trim(),
    });
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-card border border-frame/10 bg-surface-elevated shadow-dropdown"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reopen-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-muted/35 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-ink">
              <FiEdit3 className="h-4 w-4 text-ink-secondary" />
              <h2 id="reopen-title" className="text-lg font-semibold">
                Reabrir atención
              </h2>
            </div>
            <p className="mt-1 text-sm text-ink-secondary">
              Registra el motivo de reapertura antes de volver a edición.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base hover:text-ink"
            aria-label="Cerrar"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="reopen-reason-code" className="form-label">
                Motivo principal
              </label>
              <select
                id="reopen-reason-code"
                name="reopen_reason_code"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value as EncounterReopenReasonCode)}
                className="form-input"
                disabled={loading}
              >
                {ENCOUNTER_REOPEN_REASON_CODES.map((option) => (
                  <option key={option} value={option}>
                    {ENCOUNTER_REOPEN_REASON_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reopen-note" className="form-label">
                Nota de reapertura
              </label>
              <textarea
                id="reopen-note"
                name="reopen_note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (error) setError('');
                }}
                className={`form-input form-textarea ${error ? 'form-input-error' : ''}`}
                placeholder="Describe qué cambió y por qué la atención debe volver a edición…"
                autoComplete="off"
                disabled={loading}
                autoFocus
              />
              <p className="mt-2 text-xs text-ink-muted">
                Esta nota se registra en auditoría junto con el motivo estructurado.
              </p>
              {error ? (
                <p className="form-error mt-1" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-muted/35 pt-4">
            <button type="button" onClick={handleClose} disabled={loading} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Reabriendo…' : 'Reabrir atención'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
