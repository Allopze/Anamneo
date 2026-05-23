'use client';

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';

interface DataRequest {
  id: string;
  requestType: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  dueDate: string;
  prorrogaDueDate: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRut: string | null;
  payloadRequest: string;
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

export default function SolicitudesAdminPage() {
  const [items, setItems] = useState<DataRequest[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DataRequest | null>(null);

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
                      onClick={() => setSelected(it)}
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
