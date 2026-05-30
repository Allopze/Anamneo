'use client';

import type { RefObject } from 'react';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Dialog } from '@/components/common/Dialog';
import type { DataRequest, ExportDelivery, PendingDecision } from './solicitudes.types';

interface SolicitudDetailDialogProps {
  selected: DataRequest | null;
  selectedCloseRef: RefObject<HTMLButtonElement>;
  selectedExportDelivery: ExportDelivery | null;
  exportLink: string | null;
  patientId: string;
  identityVerificationMethod: string;
  identityEvidence: string;
  onClose: () => void;
  onPatientIdChange: (v: string) => void;
  onIdentityVerificationMethodChange: (v: string) => void;
  onIdentityEvidenceChange: (v: string) => void;
  onSaveVerification: () => void;
  onMarkInReview: (id: string) => void;
  onGenerateExportLink: () => void;
  openDecision: (d: PendingDecision) => void;
}

export function SolicitudDetailDialog({
  selected,
  selectedCloseRef,
  selectedExportDelivery,
  exportLink,
  patientId,
  identityVerificationMethod,
  identityEvidence,
  onClose,
  onPatientIdChange,
  onIdentityVerificationMethodChange,
  onIdentityEvidenceChange,
  onSaveVerification,
  onMarkInReview,
  onGenerateExportLink,
  openDecision,
}: SolicitudDetailDialogProps) {
  return (
    <Dialog
      isOpen={selected !== null}
      onClose={onClose}
      role="dialog"
      title={selected ? `Solicitud ${selected.requestType}` : ''}
      initialFocusRef={selectedCloseRef}
      maxWidth="xl"
      className="overflow-y-auto"
      panelStyle={{ maxHeight: '90vh' }}
    >
      {selected && (
        <div className="p-6">
          <header className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-auth-teal">
                Solicitud {selected.requestType}, {selected.status}
              </p>
              <h2 className="text-lg font-semibold">{selected.requesterName}</h2>
              <p className="text-sm text-ink-muted">{selected.requesterEmail}</p>
            </div>
            <button
              ref={selectedCloseRef}
              className="portal-icon-button"
              onClick={onClose}
              aria-label="Cerrar detalle"
            >
              Cerrar
            </button>
          </header>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-muted">RUT</dt>
              <dd>{selected.requesterRut ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Paciente vinculado</dt>
              <dd>{selected.patientId ?? 'Sin vincular'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Vence</dt>
              <dd>
                {new Date(selected.prorrogaDueDate ?? selected.dueDate).toLocaleString('es-CL')}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Descripción del titular</dt>
              <dd className="whitespace-pre-line rounded-lg bg-surface-inset p-3">
                {selected.payloadRequest}
              </dd>
            </div>
            {selected.resolutionNote && (
              <div>
                <dt className="text-xs font-semibold text-ink-muted">Nota de resolución</dt>
                <dd className="whitespace-pre-line rounded-lg bg-surface-inset p-3">
                  {selected.resolutionNote}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-4 rounded-card border border-surface-muted/60 bg-surface-inset/50 p-4">
            <p className="mb-3 text-sm font-medium">Verificación y vínculo clínico</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-label">
                ID paciente
                <input
                  value={patientId}
                  onChange={(e) => onPatientIdChange(e.target.value)}
                  className="form-input mt-1"
                  placeholder="UUID del paciente"
                />
              </label>
              <label className="form-label">
                Método de verificación
                <select
                  value={identityVerificationMethod}
                  onChange={(e) => onIdentityVerificationMethodChange(e.target.value)}
                  className="form-input mt-1"
                >
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="CEDULA_FOTO">Cédula + foto</option>
                  <option value="CLAVE_UNICA">Clave Única</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
            </div>
            <label className="form-label mt-3">
              Evidencia / nota interna
              <textarea
                value={identityEvidence}
                onChange={(e) => onIdentityEvidenceChange(e.target.value)}
                rows={2}
                className="form-textarea form-input mt-1"
                placeholder="Documento revisado, canal usado, responsable, etc."
              />
            </label>
            <button onClick={onSaveVerification} className="btn btn-primary mt-3">
              Guardar verificación
            </button>
          </div>
          {exportLink && (
            <AlertBanner
              className="mt-4"
              variant="success"
              title="Enlace generado"
              message={<p className="break-all font-mono text-xs">{exportLink}</p>}
            />
          )}
          {selectedExportDelivery?.downloadId && (
            <div className="mt-4 rounded-card border border-surface-muted/60 bg-surface-inset p-3 text-xs text-ink-secondary">
              <p className="font-medium text-ink">Entrega registrada</p>
              {selectedExportDelivery.expiresAt && (
                <p>Vence: {new Date(selectedExportDelivery.expiresAt).toLocaleString('es-CL')}</p>
              )}
              {selectedExportDelivery.fileSha256 && (
                <p className="break-all font-mono">SHA-256: {selectedExportDelivery.fileSha256}</p>
              )}
              <button
                onClick={() =>
                  openDecision({
                    kind: 'revoke',
                    title: 'Revocar enlace de descarga',
                    description:
                      'Esta acción invalida el enlace vigente. La razón queda registrada para auditoría.',
                    fieldLabel: 'Motivo de revocación',
                    placeholder:
                      'Ejemplo: solicitud duplicada, enlace enviado por error o verificación pendiente.',
                    confirmLabel: 'Revocar enlace',
                    minLength: 5,
                    downloadId: selectedExportDelivery.downloadId,
                  })
                }
                className="btn btn-danger mt-2 min-h-0 px-3 py-1.5 text-xs"
              >
                Revocar enlace
              </button>
            </div>
          )}
          {selected.status !== 'RESUELTA_ACEPTADA' && selected.status !== 'RESUELTA_RECHAZADA' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.status === 'RECIBIDA' && (
                <button
                  onClick={() => onMarkInReview(selected.id)}
                  className="btn btn-secondary min-h-0 px-3 py-1.5 text-xs"
                >
                  Marcar en revisión
                </button>
              )}
              {!selected.prorrogaDueDate && (
                <button
                  onClick={() =>
                    openDecision({
                      kind: 'extend',
                      title: 'Aplicar prórroga legal',
                      description:
                        'Registra el motivo de la prórroga de 30 días adicionales según el artículo 11.',
                      fieldLabel: 'Motivo de la prórroga',
                      placeholder:
                        'Ejemplo: verificación de identidad pendiente o recopilación de antecedentes clínicos.',
                      confirmLabel: 'Aplicar prórroga',
                      minLength: 10,
                    })
                  }
                  className="btn btn-secondary min-h-0 px-3 py-1.5 text-xs"
                >
                  Aplicar prórroga (+30 días)
                </button>
              )}
              <button
                onClick={() =>
                  openDecision({
                    kind: 'resolve-accept',
                    title: 'Resolver solicitud aceptada',
                    description:
                      'Resume qué se entregó o realizó para que el titular tenga trazabilidad clara.',
                    fieldLabel: 'Resumen para el titular',
                    placeholder: 'Ejemplo: se entrega copia de ficha clínica en archivo ZIP protegido.',
                    confirmLabel: 'Aceptar solicitud',
                    minLength: 10,
                  })
                }
                className="btn btn-success min-h-0 px-3 py-1.5 text-xs"
              >
                Resolver, aceptar
              </button>
              {['ACCESO', 'PORTABILIDAD'].includes(selected.requestType) && (
                <button
                  onClick={onGenerateExportLink}
                  className="btn btn-primary min-h-0 px-3 py-1.5 text-xs"
                >
                  Generar enlace de descarga
                </button>
              )}
              <button
                onClick={() =>
                  openDecision({
                    kind: 'resolve-reject',
                    title: 'Resolver solicitud rechazada',
                    description:
                      'Registra el motivo fundado del rechazo. Esta explicación queda asociada al expediente.',
                    fieldLabel: 'Motivo fundado del rechazo',
                    placeholder:
                      'Ejemplo: no fue posible verificar identidad con los antecedentes entregados.',
                    confirmLabel: 'Rechazar solicitud',
                    minLength: 10,
                  })
                }
                className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
              >
                Resolver, rechazar fundado
              </button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
