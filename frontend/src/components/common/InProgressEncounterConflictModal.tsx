'use client';

import React from 'react';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

export type InProgressEncounterSummary = {
  id: string;
  status: 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO' | string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; nombre: string; email?: string };
  progress?: { completed: number; total: number };
};

type PatientContext = {
  nombre: string;
  rut?: string | null;
};

export function InProgressEncounterConflictModal(props: {
  encounters: InProgressEncounterSummary[];
  patient?: PatientContext | null;
  onClose: () => void;
  onOpenEncounter: (encounterId: string) => void;
  allowCancel?: boolean;
  onCancelled?: (encounterId: string) => void;
}) {
  const { encounters, patient, onClose, onOpenEncounter, allowCancel = true, onCancelled } = props;
  const mostRecent = encounters[0];
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Atenciones en progreso</h2>
          <p className="text-sm text-slate-600">
            Hay más de una atención en progreso para este paciente. Elige cuál abrir.
          </p>
          {patient?.nombre && (
            <p className="text-xs text-slate-500 mt-2">
              Paciente: <span className="font-medium text-slate-700">{patient.nombre}</span>
              {patient.rut ? ` • ${patient.rut}` : ''}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {encounters.map((enc) => (
            <div key={enc.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">Atención {enc.id.slice(0, 8)}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(enc.createdAt).toLocaleString('es-CL')} • Por {enc.createdBy?.nombre || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {enc.progress && (
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                      {enc.progress.completed}/{enc.progress.total}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {allowCancel && (
                  <button
                    onClick={async () => {
                      if (cancellingId) return;
                      const ok = confirm('¿Cancelar esta atención en progreso?');
                      if (!ok) return;
                      try {
                        setCancellingId(enc.id);
                        await api.post(`/encounters/${enc.id}/cancel`, {});
                        toast.success('Atención cancelada');
                        onCancelled?.(enc.id);
                      } catch (e) {
                        toast.error(getErrorMessage(e));
                      } finally {
                        setCancellingId(null);
                      }
                    }}
                    disabled={Boolean(cancellingId)}
                    className="btn btn-secondary"
                  >
                    {cancellingId === enc.id ? 'Cancelando…' : 'Cancelar'}
                  </button>
                )}
                <button onClick={() => onOpenEncounter(enc.id)} className="btn btn-primary">
                  Abrir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (!mostRecent) return;
              onOpenEncounter(mostRecent.id);
            }}
            className="btn btn-primary"
          >
            Abrir más reciente
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
