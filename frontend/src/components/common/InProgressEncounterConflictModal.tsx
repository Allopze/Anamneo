'use client';

import React from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import { Dialog } from './Dialog';
import ConfirmModal from './ConfirmModal';

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
  const { encounters, patient, onClose, onOpenEncounter, allowCancel = false, onCancelled } = props;
  const mostRecent = encounters[0];
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelCandidateId, setCancelCandidateId] = React.useState<string | null>(null);

  const handleCancelConfirm = async () => {
    if (!cancelCandidateId || cancellingId) return;
    try {
      setCancellingId(cancelCandidateId);
      await api.post(`/encounters/${cancelCandidateId}/cancel`, {});
      notify.success('Atención cancelada');
      onCancelled?.(cancelCandidateId);
      setCancelCandidateId(null);
    } catch (e) {
      notify.error(getErrorMessage(e));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <>
    <Dialog
      isOpen={true}
      onClose={onClose}
      role="dialog"
      title="Atenciones en progreso"
      description="Hay más de una atención en progreso para este paciente. Elige cuál abrir."
      maxWidth="lg"
    >
      <div className="border-b border-surface-muted/30 p-5">
        <h2 className="text-lg font-semibold text-ink-primary">Atenciones en progreso</h2>
        <p className="text-sm text-ink-secondary">
          Hay más de una atención en progreso para este paciente. Elige cuál abrir.
        </p>
        {patient?.nombre && (
          <p className="mt-2 text-xs text-ink-muted">
            Paciente: <span className="font-medium text-ink-secondary">{patient.nombre}</span>
            {patient.rut ? ` • ${patient.rut}` : ''}
          </p>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-muted/30">
        {encounters.map((enc) => (
          <div key={enc.id} className="p-4 hover:bg-surface-base/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink-primary">Atención {enc.id.slice(0, 8)}</p>
                <p className="text-sm text-ink-muted">
                  {new Date(enc.createdAt).toLocaleString('es-CL')} • Por {enc.createdBy?.nombre || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {enc.progress && (
                  <span className="text-xs bg-surface-muted text-ink-secondary px-2 py-1 rounded-full">
                    {enc.progress.completed}/{enc.progress.total}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              {allowCancel && (
                <button
                  onClick={() => setCancelCandidateId(enc.id)}
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

      <div className="p-4 border-t border-surface-muted/30 flex items-center justify-between gap-3">
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
    </Dialog>
    <ConfirmModal
      isOpen={Boolean(cancelCandidateId)}
      onClose={() => {
        if (!cancellingId) setCancelCandidateId(null);
      }}
      onConfirm={handleCancelConfirm}
      title="Cancelar atención en progreso"
      message="Esta atención quedará cancelada y no se continuará editando. Usa esta acción solo si fue creada por error."
      confirmLabel="Cancelar atención"
      cancelLabel="Volver"
      variant="warning"
      loading={Boolean(cancellingId)}
    />
    </>
  );
}
