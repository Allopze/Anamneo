'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * UI admin para bloqueo temporal del tratamiento (Ley 21.719 Art 8 ter).
 * Visible solo para usuarios con rol ADMIN. Invoca los endpoints:
 *   POST /api/patients/:id/block { reason }
 *   POST /api/patients/:id/unblock { reason }
 *
 * Cuando un paciente esta bloqueado, el `PatientNotBlockedGuard` impide
 * automaticamente cualquier mutacion clinica sobre el (atenciones,
 * adjuntos, secciones, etc.).
 */

interface Props {
  patientId: string;
  blockedAt: string | Date | null;
  blockedReason: string | null;
  blockedById: string | null;
  isAdmin: boolean;
  onChanged?: () => void;
}

export default function PatientBlockingControls({
  patientId,
  blockedAt,
  blockedReason,
  isAdmin,
  onChanged,
}: Props) {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<null | 'block' | 'unblock'>(null);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const action = openModal === 'block' ? 'block' : 'unblock';
      return api.post(`/patients/${patientId}/${action}`, { reason: reason.trim() });
    },
    onSuccess: () => {
      const verb = openModal === 'block' ? 'bloqueado' : 'desbloqueado';
      toast.success(`Paciente ${verb}`);
      setOpenModal(null);
      setReason('');
      onChanged?.();
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin) {
    if (!blockedAt) return null;
    // Aun sin admin, mostramos badge informativo si el paciente esta bloqueado.
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
        <p className="font-semibold">Tratamiento bloqueado (Ley 21.719 Art 8 ter)</p>
        <p className="mt-1">
          Desde {format(new Date(blockedAt), "d MMM yyyy HH:mm", { locale: es })}.
          {blockedReason && ` Motivo: ${blockedReason}.`}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <header className="mb-2">
        <p className="text-xs uppercase tracking-wide text-teal-700">
          Ley 21.719 — Art 8 ter
        </p>
        <h3 className="text-sm font-semibold text-slate-900">Bloqueo temporal del tratamiento</h3>
      </header>
      {blockedAt ? (
        <div className="space-y-2">
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <p className="font-semibold">Bloqueado</p>
            <p className="mt-1">
              Desde {format(new Date(blockedAt), "d MMM yyyy HH:mm", { locale: es })}.
              {blockedReason && (
                <>
                  <br />
                  <span className="font-medium">Motivo:</span> {blockedReason}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenModal('unblock')}
            className="w-full rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-800"
          >
            Levantar bloqueo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            El paciente no esta bloqueado. Bloquear suspende todas las mutaciones
            clinicas (atenciones, adjuntos, alertas) hasta que se levante el bloqueo.
          </p>
          <button
            type="button"
            onClick={() => setOpenModal('block')}
            className="w-full rounded bg-rose-700 px-3 py-1 text-xs text-white hover:bg-rose-800"
          >
            Bloquear tratamiento
          </button>
        </div>
      )}

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {openModal === 'block' ? 'Bloquear tratamiento' : 'Levantar bloqueo'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {openModal === 'block'
                ? 'Bloquear temporalmente impide nuevas mutaciones clinicas sobre el paciente. Plazo del responsable para resolver: 2 dias habiles.'
                : 'Levantar el bloqueo permite nuevamente mutaciones clinicas. Documente la razon para auditoria.'}
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-700">
              Razon (minimo 10 caracteres)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Documente la razon completa"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpenModal(null);
                  setReason('');
                }}
                className="text-xs text-slate-600 underline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (reason.trim().length < 10) {
                    toast.error('La razon debe tener al menos 10 caracteres');
                    return;
                  }
                  mutation.mutate();
                }}
                disabled={mutation.isPending}
                className={`rounded px-3 py-1 text-xs text-white disabled:opacity-50 ${
                  openModal === 'block' ? 'bg-rose-700' : 'bg-emerald-700'
                }`}
              >
                {mutation.isPending
                  ? 'Guardando…'
                  : openModal === 'block'
                    ? 'Confirmar bloqueo'
                    : 'Confirmar desbloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
