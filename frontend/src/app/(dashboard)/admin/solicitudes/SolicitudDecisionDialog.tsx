'use client';

import type { RefObject } from 'react';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Dialog } from '@/components/common/Dialog';
import type { PendingDecision } from './solicitudes.types';

interface SolicitudDecisionDialogProps {
  pendingDecision: PendingDecision | null;
  decisionNote: string;
  decisionError: string | null;
  decisionSubmitting: boolean;
  decisionCancelRef: RefObject<HTMLButtonElement>;
  onDecisionNoteChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function SolicitudDecisionDialog({
  pendingDecision,
  decisionNote,
  decisionError,
  decisionSubmitting,
  decisionCancelRef,
  onDecisionNoteChange,
  onSubmit,
  onCancel,
}: SolicitudDecisionDialogProps) {
  return (
    <Dialog
      isOpen={pendingDecision !== null}
      onClose={() => {
        if (!decisionSubmitting) onCancel();
      }}
      role="alertdialog"
      title={pendingDecision?.title ?? ''}
      description={pendingDecision?.description}
      initialFocusRef={decisionCancelRef}
      loading={decisionSubmitting}
      maxWidth="lg"
    >
      {pendingDecision && (
        <div className="p-6">
          <div>
            <p className="text-sm font-semibold text-auth-teal">Decisión auditada</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{pendingDecision.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">{pendingDecision.description}</p>
          </div>

          <label className="form-label mt-5" htmlFor="data-request-decision-note">
            {pendingDecision.fieldLabel}
          </label>
          <textarea
            id="data-request-decision-note"
            className="form-textarea form-input mt-1"
            rows={4}
            value={decisionNote}
            onChange={(event) => onDecisionNoteChange(event.target.value)}
            placeholder={pendingDecision.placeholder}
            disabled={decisionSubmitting}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Mínimo {pendingDecision.minLength} caracteres. Este texto queda disponible para trazabilidad y
            auditoría.
          </p>

          {decisionError ? (
            <AlertBanner className="mt-4" variant="error" message={decisionError} />
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              ref={decisionCancelRef}
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={decisionSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={
                pendingDecision.kind === 'resolve-reject' || pendingDecision.kind === 'revoke'
                  ? 'btn btn-danger'
                  : 'btn btn-primary'
              }
              onClick={onSubmit}
              disabled={decisionSubmitting}
            >
              {decisionSubmitting ? 'Guardando...' : pendingDecision.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
