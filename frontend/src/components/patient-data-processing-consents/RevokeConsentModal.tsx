'use client';

import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { MIN_REVOKE_REASON_LENGTH, REVOKE_CHANNELS } from './constants';
import { DataProcessingConsent, RevokeChannel } from './types';
import { formatConsentDate, purposeLabel } from './utils';

interface Props {
  consent: DataProcessingConsent;
  isPending: boolean;
  reason: string;
  channel: RevokeChannel;
  onCancel: () => void;
  onChannelChange: (channel: RevokeChannel) => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
}

export default function RevokeConsentModal({
  consent,
  isPending,
  reason,
  channel,
  onCancel,
  onChannelChange,
  onConfirm,
  onReasonChange,
}: Props) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          aria-describedby="revoke-modal-desc"
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-red/20 text-status-red">
                <FiAlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 id="revoke-modal-title" className="text-lg font-semibold text-ink-primary">
                  Revocar consentimiento
                </h3>
                <p id="revoke-modal-desc" className="mt-1 text-sm text-ink-secondary">
                  La revocación detiene el tratamiento basado en este consentimiento.
                  No implica supresión automática cuando exista obligación legal de
                  conservación (ej. ficha clínica sanitaria).
                </p>
              </div>
              <button
                onClick={onCancel}
                disabled={isPending}
                className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                aria-label="Cerrar"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-card border border-status-red/20 bg-status-red/5 p-3 text-xs space-y-1">
              <p className="font-semibold text-[11px] uppercase tracking-wide text-status-red">
                Acto legal que se revoca
              </p>
              <p className="text-ink-primary">
                <span className="font-medium">Finalidad:</span> {purposeLabel(consent.purpose)}
              </p>
              <p className="text-ink-secondary">
                <span className="font-medium">Firmante:</span> {consent.signerName}
                {consent.signerRut ? ` · RUT ${consent.signerRut}` : ''}
                {' '}({consent.signerRelationship})
              </p>
              <p className="text-ink-secondary">
                <span className="font-medium">Otorgado:</span> {formatConsentDate(consent.grantedAt)} hrs
              </p>
              {consent.legalDocument && (
                <p className="text-ink-muted">
                  <span className="font-medium">Política:</span> {consent.legalDocument.title} v{consent.legalDocument.version}
                </p>
              )}
              <p className="font-mono text-[10px] text-ink-muted">
                Hash de evidencia: {consent.evidenceHash.slice(0, 24)}…
              </p>
            </div>

            <label className="mt-4 block text-sm font-medium text-ink-primary" htmlFor="revoke-reason">
              Motivo de revocación (mínimo {MIN_REVOKE_REASON_LENGTH} caracteres)
            </label>
            <textarea
              id="revoke-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              className="form-input mt-1 w-full text-sm"
              placeholder="Documente el motivo completo para auditoría regulatoria"
              disabled={isPending}
            />
            <p className="mt-0.5 text-right text-[10px] text-ink-muted">
              {reason.trim().length}/{MIN_REVOKE_REASON_LENGTH} caracteres mín.
            </p>

            <div className="mt-2">
              <label className="form-label text-sm" htmlFor="revoke-channel">Canal de revocación</label>
              <select
                id="revoke-channel"
                value={channel}
                onChange={(e) => onChannelChange(e.target.value as RevokeChannel)}
                disabled={isPending}
                className="form-input mt-1 text-sm"
              >
                {REVOKE_CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
            <button type="button" onClick={onCancel} disabled={isPending} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={isPending} className="btn btn-danger">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Revocando…
                </span>
              ) : (
                'Confirmar revocación'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
