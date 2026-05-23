'use client';

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';

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

  const handleResolve = async (id: string, decision: 'RESUELTA_ACEPTADA' | 'RESUELTA_RECHAZADA') => {
    const note = window.prompt(
      decision === 'RESUELTA_ACEPTADA'
        ? 'Resumen breve para el titular (qué se entregó/realizó):'
        : 'Motivo fundado del rechazo (requerido por Ley 21.719 Art 11):',
    );
    if (!note || note.trim().length < 10) {
      alert('La justificación debe tener al menos 10 caracteres');
      return;
    }
    try {
      await api.post(`/admin/data-requests/${id}/resolve`, {
        status: decision,
        resolutionNote: note.trim(),
      });
      setSelected(null);
      await load(status);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleExtend = async (id: string) => {
    const reason = window.prompt('Motivo de la prórroga (30 días adicionales, Art 11):');
    if (!reason || reason.trim().length < 10) {
      alert('El motivo debe tener al menos 10 caracteres');
      return;
    }
    try {
      await api.post(`/admin/data-requests/${id}/extend`, { reason: reason.trim() });
      await load(status);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleMarkInReview = async (id: string) => {
    try {
      await api.patch(`/admin/data-requests/${id}`, { status: 'EN_REVISION' });
      await load(status);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleSaveVerification = async () => {
    if (!selected) return;
    if (!patientId.trim()) {
      alert('Debes ingresar el ID del paciente');
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
      alert(getErrorMessage(err));
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
        alert(`Enlace generado, pero no se pudo enviar correo: ${res.data.mail.reason ?? 'SMTP no configurado'}`);
      }
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleRevokeExportLink = async (downloadId: string) => {
    const reason = window.prompt('Motivo de revocación del enlace:');
    if (!reason || reason.trim().length < 5) {
      alert('Indica un motivo breve para auditar la revocación');
      return;
    }
    try {
      await api.post(`/admin/data-request-downloads/${downloadId}/revoke`, { reason: reason.trim() });
      setExportLink(null);
      await load(status);
      alert('Enlace revocado');
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-700">
            Ley 21.719 — Art 4 a 11
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Solicitudes de derechos de titulares
          </h1>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1 text-sm"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando solicitudes…</p>
      ) : (
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-1/12 py-2">Tipo</th>
              <th className="w-1/12 py-2">Estado</th>
              <th className="w-2/12 py-2">Solicitante</th>
              <th className="w-2/12 py-2">Email</th>
              <th className="w-1/12 py-2">Recibida</th>
              <th className="w-1/12 py-2">Vence</th>
              <th className="w-2/12 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const due = it.prorrogaDueDate ?? it.dueDate;
              const overdue = new Date(due) < new Date();
              return (
                <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-xs">{it.requestType}</td>
                  <td className="py-2 text-xs">{it.status}</td>
                  <td className="py-2">{it.requesterName}</td>
                  <td className="py-2 text-xs">{it.requesterEmail}</td>
                  <td className="py-2 text-xs">
                    {new Date(it.submittedAt).toLocaleDateString('es-CL')}
                  </td>
                  <td className={`py-2 text-xs ${overdue ? 'text-rose-600 font-semibold' : ''}`}>
                    {new Date(due).toLocaleDateString('es-CL')}
                  </td>
                  <td className="py-2 text-xs">
                    <button
                      className="mr-2 text-teal-700 underline"
                      onClick={() => {
                        setSelected(it);
                        setPatientId(it.patientId ?? '');
                        setIdentityVerificationMethod(it.identityVerificationMethod ?? 'PRESENCIAL');
                        setIdentityEvidence('');
                        setExportLink(null);
                      }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                  No hay solicitudes con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <header className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-teal-700">
                  Solicitud {selected.requestType} — {selected.status}
                </p>
                <h2 className="text-lg font-semibold">{selected.requesterName}</h2>
                <p className="text-sm text-slate-500">{selected.requesterEmail}</p>
              </div>
              <button
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </header>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500">RUT</dt>
                <dd>{selected.requesterRut ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Paciente vinculado</dt>
                <dd>{selected.patientId ?? 'Sin vincular'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Vence</dt>
                <dd>
                  {new Date(selected.prorrogaDueDate ?? selected.dueDate).toLocaleString('es-CL')}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Descripción del titular</dt>
                <dd className="whitespace-pre-line rounded bg-slate-50 p-2">
                  {selected.payloadRequest}
                </dd>
              </div>
              {selected.resolutionNote && (
                <div>
                  <dt className="text-xs uppercase text-slate-500">Nota de resolución</dt>
                  <dd className="whitespace-pre-line rounded bg-slate-50 p-2">
                    {selected.resolutionNote}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="mb-3 text-sm font-medium">Verificación y vínculo clínico</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-600">
                  ID paciente
                  <input
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="UUID del paciente"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Método de verificación
                  <select
                    value={identityVerificationMethod}
                    onChange={(e) => setIdentityVerificationMethod(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="CEDULA_FOTO">Cédula + foto</option>
                    <option value="CLAVE_UNICA">Clave Única</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-xs text-slate-600">
                Evidencia / nota interna
                <textarea
                  value={identityEvidence}
                  onChange={(e) => setIdentityEvidence(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="Documento revisado, canal usado, responsable, etc."
                />
              </label>
              <button
                onClick={handleSaveVerification}
                className="mt-3 rounded bg-slate-800 px-3 py-1 text-xs text-white"
              >
                Guardar verificación
              </button>
            </div>
            {exportLink && (
              <div className="mt-4 rounded border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">
                Enlace generado y enviado si SMTP está configurado:
                <p className="mt-1 break-all font-mono">{exportLink}</p>
              </div>
            )}
            {selectedExportDelivery?.downloadId && (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-medium text-slate-900">Entrega registrada</p>
                {selectedExportDelivery.expiresAt && (
                  <p>Vence: {new Date(selectedExportDelivery.expiresAt).toLocaleString('es-CL')}</p>
                )}
                {selectedExportDelivery.fileSha256 && (
                  <p className="break-all font-mono">SHA-256: {selectedExportDelivery.fileSha256}</p>
                )}
                <button
                  onClick={() => handleRevokeExportLink(selectedExportDelivery.downloadId!)}
                  className="mt-2 rounded bg-rose-700 px-3 py-1 text-xs text-white"
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
                      className="rounded bg-slate-200 px-3 py-1 text-xs"
                    >
                      Marcar en revisión
                    </button>
                  )}
                  {!selected.prorrogaDueDate && (
                    <button
                      onClick={() => handleExtend(selected.id)}
                      className="rounded bg-slate-200 px-3 py-1 text-xs"
                    >
                      Aplicar prórroga (+30 días)
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(selected.id, 'RESUELTA_ACEPTADA')}
                    className="rounded bg-teal-700 px-3 py-1 text-xs text-white"
                  >
                    Resolver — aceptar
                  </button>
                  {['ACCESO', 'PORTABILIDAD'].includes(selected.requestType) && (
                    <button
                      onClick={handleGenerateExportLink}
                      className="rounded bg-cyan-700 px-3 py-1 text-xs text-white"
                    >
                      Generar enlace de descarga
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(selected.id, 'RESUELTA_RECHAZADA')}
                    className="rounded bg-rose-700 px-3 py-1 text-xs text-white"
                  >
                    Resolver — rechazar fundado
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
