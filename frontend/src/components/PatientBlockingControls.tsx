'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
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

  const handleClose = () => {
    if (mutation.isPending) return;
    setOpenModal(null);
    setReason('');
  };

  const handleConfirm = () => {
    if (reason.trim().length < 10) {
      toast.error('La razón debe tener al menos 10 caracteres');
      return;
    }
    mutation.mutate();
  };

  if (!isAdmin) {
    if (!blockedAt) return null;
    return (
      <div className="rounded-card border border-status-red/20 bg-status-red/10 p-3 text-xs text-status-red">
        <p className="font-semibold">Tratamiento bloqueado (Ley 21.719 Art 8 ter)</p>
        <p className="mt-1 text-ink-secondary">
          Desde {format(new Date(blockedAt), 'dd/MM/yyyy HH:mm', { locale: es })} hrs.
          {blockedReason && ` Motivo: ${blockedReason}.`}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-card border border-surface-muted/30 bg-surface-elevated p-4">
      <header className="mb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Ley 21.719 — Art 8 ter
        </p>
        <h3 className="text-sm font-semibold text-ink-primary">Bloqueo temporal del tratamiento</h3>
      </header>

      {blockedAt ? (
        <div className="space-y-2">
          <div className="rounded-card border border-status-red/20 bg-status-red/10 p-3 text-xs">
            <p className="font-semibold text-status-red">Bloqueado</p>
            <p className="mt-1 text-ink-secondary">
              Desde {format(new Date(blockedAt), 'dd/MM/yyyy HH:mm', { locale: es })} hrs.
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
            className="btn btn-secondary w-full text-xs"
          >
            Levantar bloqueo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-ink-secondary">
            El paciente no está bloqueado. Bloquear suspende todas las mutaciones
            clínicas (atenciones, adjuntos, alertas) hasta que se levante el bloqueo.
          </p>
          <button
            type="button"
            onClick={() => setOpenModal('block')}
            className="btn btn-danger w-full text-xs"
          >
            Bloquear tratamiento
          </button>
        </div>
      )}

      {openModal ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="blocking-modal-title"
              aria-describedby="blocking-modal-desc"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${openModal === 'block' ? 'bg-status-red/20 text-status-red' : 'border border-status-yellow/65 bg-status-yellow/35 text-accent-text'}`}>
                    <FiAlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 id="blocking-modal-title" className="text-lg font-semibold text-ink-primary">
                      {openModal === 'block' ? 'Bloquear tratamiento' : 'Levantar bloqueo'}
                    </h3>
                    <p id="blocking-modal-desc" className="mt-2 text-sm text-ink-secondary">
                      {openModal === 'block'
                        ? 'Bloquear temporalmente impide nuevas mutaciones clínicas sobre el paciente. El responsable debe resolver en 2 días hábiles (Art 8 ter).'
                        : 'Levantar el bloqueo reanuda las mutaciones clínicas. Documente la razón para auditoría.'}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                    aria-label="Cerrar"
                    disabled={mutation.isPending}
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <label className="mt-4 block text-sm font-medium text-ink-primary" htmlFor="blocking-reason">
                  Razón (mínimo 10 caracteres)
                </label>
                <textarea
                  id="blocking-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="form-input mt-1 w-full text-sm"
                  placeholder="Documente la razón completa para auditoría"
                  disabled={mutation.isPending}
                />
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary"
                  disabled={mutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={mutation.isPending}
                  className={openModal === 'block' ? 'btn btn-danger' : 'btn btn-primary'}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Guardando…
                    </span>
                  ) : openModal === 'block' ? (
                    'Confirmar bloqueo'
                  ) : (
                    'Confirmar desbloqueo'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
