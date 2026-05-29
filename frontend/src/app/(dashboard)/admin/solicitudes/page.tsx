'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertBanner } from '@/components/common/AlertBanner';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog } from '@/components/common/Dialog';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';

interface DataRequest {
  id: string;
  patientId: string | null;
  requestType: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  dueDate: string;
  prorrogaDueDate: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRut: string | null;
  identityVerificationMethod: string | null;
  identityVerificationEvidence: unknown | null;
  payloadRequest: string;
  payloadResponse: unknown | null;
  resolutionNote: string | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'RECIBIDA', label: 'Recibidas' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'RESUELTA_ACEPTADA', label: 'Resueltas (aceptadas)' },
  { value: 'RESUELTA_RECHAZADA', label: 'Resueltas (rechazadas)' },
  { value: 'VENCIDA', label: 'Vencidas' },
];

interface ExportDelivery {
  downloadId?: string;
  expiresAt?: string;
  maxDownloads?: number;
  fileSha256?: string;
}

type DecisionKind = 'resolve-accept' | 'resolve-reject' | 'extend' | 'revoke';

interface PendingDecision {
  kind: DecisionKind;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  confirmLabel: string;
  minLength: number;
  downloadId?: string;
}

function getExportDelivery(payload: unknown): ExportDelivery | null {
  if (!payload || typeof payload !== 'object' || !('exportDelivery' in payload)) return null;
  const delivery = (payload as { exportDelivery?: unknown }).exportDelivery;
  if (!delivery || typeof delivery !== 'object') return null;
  return delivery as ExportDelivery;
}

export default function SolicitudesAdminPage() {
  const [items, setItems] = useState<DataRequest[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DataRequest | null>(null);
  const [patientId, setPatientId] = useState('');
  const [identityVerificationMethod, setIdentityVerificationMethod] = useState('PRESENCIAL');
  const [identityEvidence, setIdentityEvidence] = useState('');
  const [exportLink, setExportLink] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const decisionCancelRef = useRef<HTMLButtonElement>(null);
  const selectedCloseRef = useRef<HTMLButtonElement>(null);
  const selectedExportDelivery = selected ? getExportDelivery(selected.payloadResponse) : null;

  const load = async (filterStatus?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DataRequest[]>('/admin/data-requests', {
        params: filterStatus ? { status: filterStatus } : {},
      });
      setItems(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(status);
  }, [status]);

  const openDecision = (decision: PendingDecision) => {
    setPendingDecision(decision);
    setDecisionNote('');
    setDecisionError(null);
  };

  const handleMarkInReview = async (id: string) => {
    try {
      await api.patch(`/admin/data-requests/${id}`, { status: 'EN_REVISION' });
      await load(status);
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleSaveVerification = async () => {
    if (!selected) return;
    if (!patientId.trim()) {
      notify.error('Ingresa el ID del paciente antes de guardar la verificación.');
      return;
    }
    try {
      const res = await api.patch<DataRequest>(`/admin/data-requests/${selected.id}`, {
        patientId: patientId.trim(),
        identityVerificationMethod,
        identityVerificationEvidence: {
          note: identityEvidence.trim() || null,
          recordedAt: new Date().toISOString(),
        },
        status: selected.status === 'RECIBIDA' ? 'EN_REVISION' : undefined,
      });
      setSelected(res.data);
      await load(status);
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleGenerateExportLink = async () => {
    if (!selected) return;
    try {
      const res = await api.post<{
        id: string;
        downloadUrl: string;
        expiresAt: string;
        maxDownloads: number;
        mail: { sent: boolean; reason: string | null };
      }>(
        `/admin/data-requests/${selected.id}/export-link`,
        {},
      );
      setExportLink(res.data.downloadUrl);
      setSelected({
        ...selected,
        payloadResponse: {
          exportDelivery: {
            downloadId: res.data.id,
            expiresAt: res.data.expiresAt,
            maxDownloads: res.data.maxDownloads,
          },
        },
      });
      await load(status);
      if (!res.data.mail.sent) {
        notify.info(`Enlace generado, pero no se pudo enviar correo: ${res.data.mail.reason ?? 'SMTP no configurado'}`);
      }
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleSubmitDecision = async () => {
    if (!selected || !pendingDecision) return;

    const note = decisionNote.trim();
    if (note.length < pendingDecision.minLength) {
      setDecisionError(`Ingresa al menos ${pendingDecision.minLength} caracteres para auditar la decisión.`);
      return;
    }

    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      if (pendingDecision.kind === 'resolve-accept' || pendingDecision.kind === 'resolve-reject') {
        await api.post(`/admin/data-requests/${selected.id}/resolve`, {
          status: pendingDecision.kind === 'resolve-accept' ? 'RESUELTA_ACEPTADA' : 'RESUELTA_RECHAZADA',
          resolutionNote: note,
        });
        setSelected(null);
      }

      if (pendingDecision.kind === 'extend') {
        await api.post(`/admin/data-requests/${selected.id}/extend`, { reason: note });
      }

      if (pendingDecision.kind === 'revoke' && pendingDecision.downloadId) {
        await api.post(`/admin/data-request-downloads/${pendingDecision.downloadId}/revoke`, { reason: note });
        setExportLink(null);
        notify.success('Enlace revocado');
      }

      setPendingDecision(null);
      setDecisionNote('');
      await load(status);
    } catch (err) {
      setDecisionError(getErrorMessage(err));
    } finally {
      setDecisionSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-auth-teal">
            Ley 21.719, artículos 4 a 11
          </p>
          <h1 className="text-2xl font-semibold text-ink">
            Solicitudes de derechos de titulares
          </h1>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="form-input w-auto min-w-52 py-2"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <AlertBanner variant="error" message={error} />
      )}

      {loading ? (
        <div className="portal-table-shell space-y-3 p-4" aria-busy="true" aria-label="Cargando solicitudes">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="grid gap-3 border-b border-surface-muted/60 py-3 last:border-b-0 md:grid-cols-7">
              <div className="h-4 w-16 skeleton" />
              <div className="h-4 w-20 skeleton" />
              <div className="h-4 w-28 skeleton md:col-span-2" />
              <div className="h-4 w-24 skeleton" />
              <div className="h-4 w-20 skeleton" />
              <div className="h-4 w-16 skeleton" />
            </div>
          ))}
        </div>
      ) : (
        <div className="portal-table-shell">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-surface-muted/70 bg-surface-inset text-xs text-ink-muted">
              <tr>
                <th className="w-1/12 px-3 py-3 font-semibold">Tipo</th>
                <th className="w-1/12 px-3 py-3 font-semibold">Estado</th>
                <th className="w-2/12 px-3 py-3 font-semibold">Solicitante</th>
                <th className="w-2/12 px-3 py-3 font-semibold">Email</th>
                <th className="w-1/12 px-3 py-3 font-semibold">Recibida</th>
                <th className="w-1/12 px-3 py-3 font-semibold">Vence</th>
                <th className="w-2/12 px-3 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted/60">
              {items.map((it) => {
                const due = it.prorrogaDueDate ?? it.dueDate;
                const overdue = new Date(due) < new Date();
                return (
                  <tr key={it.id} className="hover:bg-surface-inset/70">
                    <td className="px-3 py-3 text-xs text-ink-secondary">{it.requestType}</td>
                    <td className="px-3 py-3 text-xs text-ink-secondary">{it.status}</td>
                    <td className="px-3 py-3 text-ink">{it.requesterName}</td>
                    <td className="px-3 py-3 text-xs text-ink-secondary">{it.requesterEmail}</td>
                    <td className="px-3 py-3 text-xs text-ink-secondary">
                      {new Date(it.submittedAt).toLocaleDateString('es-CL')}
                    </td>
                    <td className={`px-3 py-3 text-xs ${overdue ? 'font-semibold text-status-red-text' : 'text-ink-secondary'}`}>
                      {new Date(due).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <button
                        className="font-semibold text-auth-teal underline-offset-4 hover:underline"
                        onClick={() => {
                          setSelected(it);
                          setPatientId(it.patientId ?? '');
                          setIdentityVerificationMethod(it.identityVerificationMethod ?? 'PRESENCIAL');
                          setIdentityEvidence('');
                          setExportLink(null);
                        }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8">
                    <EmptyState
                      title="Sin solicitudes para este filtro"
                      description="Cambia el estado seleccionado para revisar solicitudes recibidas, en revisión, resueltas o vencidas."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
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
                onClick={() => setSelected(null)}
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
                    onChange={(e) => setPatientId(e.target.value)}
                    className="form-input mt-1"
                    placeholder="UUID del paciente"
                  />
                </label>
                <label className="form-label">
                  Método de verificación
                  <select
                    value={identityVerificationMethod}
                    onChange={(e) => setIdentityVerificationMethod(e.target.value)}
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
                  onChange={(e) => setIdentityEvidence(e.target.value)}
                  rows={2}
                  className="form-textarea form-input mt-1"
                  placeholder="Documento revisado, canal usado, responsable, etc."
                />
              </label>
              <button
                onClick={handleSaveVerification}
                className="btn btn-primary mt-3"
              >
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
                  onClick={() => openDecision({
                    kind: 'revoke',
                    title: 'Revocar enlace de descarga',
                    description: 'Esta acción invalida el enlace vigente. La razón queda registrada para auditoría.',
                    fieldLabel: 'Motivo de revocación',
                    placeholder: 'Ejemplo: solicitud duplicada, enlace enviado por error o verificación pendiente.',
                    confirmLabel: 'Revocar enlace',
                    minLength: 5,
                    downloadId: selectedExportDelivery.downloadId,
                  })}
                  className="btn btn-danger mt-2 min-h-0 px-3 py-1.5 text-xs"
                >
                  Revocar enlace
                </button>
              </div>
            )}
            {selected.status !== 'RESUELTA_ACEPTADA' &&
              selected.status !== 'RESUELTA_RECHAZADA' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.status === 'RECIBIDA' && (
                    <button
                      onClick={() => handleMarkInReview(selected.id)}
                      className="btn btn-secondary min-h-0 px-3 py-1.5 text-xs"
                    >
                      Marcar en revisión
                    </button>
                  )}
                  {!selected.prorrogaDueDate && (
                    <button
                      onClick={() => openDecision({
                        kind: 'extend',
                        title: 'Aplicar prórroga legal',
                        description: 'Registra el motivo de la prórroga de 30 días adicionales según el artículo 11.',
                        fieldLabel: 'Motivo de la prórroga',
                        placeholder: 'Ejemplo: verificación de identidad pendiente o recopilación de antecedentes clínicos.',
                        confirmLabel: 'Aplicar prórroga',
                        minLength: 10,
                      })}
                      className="btn btn-secondary min-h-0 px-3 py-1.5 text-xs"
                    >
                      Aplicar prórroga (+30 días)
                    </button>
                  )}
                  <button
                    onClick={() => openDecision({
                      kind: 'resolve-accept',
                      title: 'Resolver solicitud aceptada',
                      description: 'Resume qué se entregó o realizó para que el titular tenga trazabilidad clara.',
                      fieldLabel: 'Resumen para el titular',
                      placeholder: 'Ejemplo: se entrega copia de ficha clínica en archivo ZIP protegido.',
                      confirmLabel: 'Aceptar solicitud',
                      minLength: 10,
                    })}
                    className="btn btn-success min-h-0 px-3 py-1.5 text-xs"
                  >
                    Resolver, aceptar
                  </button>
                  {['ACCESO', 'PORTABILIDAD'].includes(selected.requestType) && (
                    <button
                      onClick={handleGenerateExportLink}
                      className="btn btn-primary min-h-0 px-3 py-1.5 text-xs"
                    >
                      Generar enlace de descarga
                    </button>
                  )}
                  <button
                    onClick={() => openDecision({
                      kind: 'resolve-reject',
                      title: 'Resolver solicitud rechazada',
                      description: 'Registra el motivo fundado del rechazo. Esta explicación queda asociada al expediente.',
                      fieldLabel: 'Motivo fundado del rechazo',
                      placeholder: 'Ejemplo: no fue posible verificar identidad con los antecedentes entregados.',
                      confirmLabel: 'Rechazar solicitud',
                      minLength: 10,
                    })}
                    className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
                  >
                    Resolver, rechazar fundado
                  </button>
                </div>
              )}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={pendingDecision !== null}
        onClose={() => {
          if (!decisionSubmitting) {
            setPendingDecision(null);
            setDecisionNote('');
            setDecisionError(null);
          }
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
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {pendingDecision.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                {pendingDecision.description}
              </p>
            </div>

            <label className="form-label mt-5" htmlFor="data-request-decision-note">
              {pendingDecision.fieldLabel}
            </label>
            <textarea
              id="data-request-decision-note"
              className="form-textarea form-input mt-1"
              rows={4}
              value={decisionNote}
              onChange={(event) => {
                setDecisionNote(event.target.value);
                setDecisionError(null);
              }}
              placeholder={pendingDecision.placeholder}
              disabled={decisionSubmitting}
            />
            <p className="mt-2 text-xs text-ink-muted">
              Mínimo {pendingDecision.minLength} caracteres. Este texto queda disponible para trazabilidad y auditoría.
            </p>

            {decisionError ? (
              <AlertBanner className="mt-4" variant="error" message={decisionError} />
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={decisionCancelRef}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPendingDecision(null);
                  setDecisionNote('');
                  setDecisionError(null);
                }}
                disabled={decisionSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={pendingDecision.kind === 'resolve-reject' || pendingDecision.kind === 'revoke' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={handleSubmitDecision}
                disabled={decisionSubmitting}
              >
                {decisionSubmitting ? 'Guardando...' : pendingDecision.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
