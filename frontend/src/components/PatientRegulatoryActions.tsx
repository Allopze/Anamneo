'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FiDownloadCloud, FiTrash2, FiX } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import { downloadPatientRegulatoryExport } from '@/app/(dashboard)/pacientes/[id]/patient-detail.helpers';
import type { Patient } from '@/types';

/**
 * Acciones regulatorias de nivel admin para un paciente (Ley 19.628 / Ley 21.719).
 *   - Exportar paquete regulatorio (ZIP cifrado con todos los datos + adjuntos).
 *   - Suprimir paciente definitivamente (derecho de supresión / Art. 11).
 *
 * Solo visible para usuarios con rol ADMIN. Ambas acciones invocan endpoints
 * de `PatientsRegulatoryController` que requieren `AdminGuard`.
 */

const CONFIRMATION_WORD = 'PURGE-REGULATORY';

interface Props {
  patient: Patient;
  isAdmin: boolean;
}

export default function PatientRegulatoryActions({ patient, isAdmin }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [downloadPending, setDownloadPending] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [justification, setJustification] = useState('');

  const purgeMutation = useMutation({
    mutationFn: () =>
      api.delete(`/patients/${patient.id}/purge`, {
        data: { confirmation: confirmText.trim(), justification: justification.trim() },
      }),
    onSuccess: () => {
      notify.success('Paciente suprimido definitivamente');
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      router.push('/pacientes');
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  if (!isAdmin) return null;

  const handleDownload = async () => {
    setDownloadPending(true);
    try {
      await downloadPatientRegulatoryExport(patient.id, patient);
      notify.success('Paquete regulatorio descargado');
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setDownloadPending(false);
    }
  };

  const handlePurgeConfirm = () => {
    if (confirmText.trim() !== CONFIRMATION_WORD) {
      notify.error(`Debes escribir exactamente "${CONFIRMATION_WORD}" para confirmar`);
      return;
    }
    if (justification.trim().length < 20) {
      notify.error('La justificación debe tener al menos 20 caracteres');
      return;
    }
    purgeMutation.mutate();
  };

  const handlePurgeClose = () => {
    if (purgeMutation.isPending) return;
    setShowPurgeModal(false);
    setConfirmText('');
    setJustification('');
  };

  return (
    <section className="rounded-card border border-surface-muted/30 bg-surface-elevated p-4">
      <header className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Ley 19.628 / Ley 21.719
        </p>
        <h3 className="text-sm font-semibold text-ink-primary">Acciones regulatorias</h3>
      </header>

      <div className="space-y-2">
        {/* Export regulatorio */}
        <button
          type="button"
          onClick={() => { void handleDownload(); }}
          disabled={downloadPending}
          className="btn btn-secondary w-full justify-start gap-2 text-xs"
        >
          <FiDownloadCloud className="h-3.5 w-3.5 shrink-0" />
          {downloadPending ? 'Generando ZIP…' : 'Exportar paquete regulatorio (ZIP)'}
        </button>
        <p className="text-xs text-ink-muted">
          Incluye todos los datos clínicos y adjuntos en formato cifrado (Art. 11 – portabilidad).
        </p>

        {/* Purge */}
        <div className="mt-3 border-t border-surface-muted/30 pt-3">
          <button
            type="button"
            onClick={() => setShowPurgeModal(true)}
            className="btn btn-danger w-full justify-start gap-2 text-xs"
          >
            <FiTrash2 className="h-3.5 w-3.5 shrink-0" />
            Suprimir paciente (derecho de supresión)
          </button>
          <p className="mt-1 text-xs text-status-red/80">
            Acción irreversible. Elimina definitivamente todos los datos del paciente.
          </p>
        </div>
      </div>

      {/* Modal de confirmación de purge */}
      {showPurgeModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm"
            onClick={handlePurgeClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="purge-modal-title"
              aria-describedby="purge-modal-desc"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-red/20 text-status-red">
                    <FiTrash2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 id="purge-modal-title" className="text-lg font-semibold text-ink-primary">
                      Suprimir paciente definitivamente
                    </h3>
                    <p id="purge-modal-desc" className="mt-2 text-sm text-ink-secondary">
                      Esta acción es <strong className="text-status-red">irreversible</strong>.
                      Se eliminarán todos los datos del paciente, incluyendo atenciones,
                      adjuntos y registros de auditoría. Un snapshot cifrado queda en el
                      servidor para cumplimiento regulatorio.
                    </p>
                  </div>
                  <button
                    onClick={handlePurgeClose}
                    className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                    aria-label="Cerrar"
                    disabled={purgeMutation.isPending}
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      className="block text-sm font-medium text-ink-primary"
                      htmlFor="purge-confirm"
                    >
                      Escribe <code className="rounded bg-surface-muted/30 px-1 font-mono text-xs">{CONFIRMATION_WORD}</code> para confirmar
                    </label>
                    <input
                      id="purge-confirm"
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="form-input mt-1 w-full font-mono text-sm"
                      placeholder={CONFIRMATION_WORD}
                      disabled={purgeMutation.isPending}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-ink-primary"
                      htmlFor="purge-justification"
                    >
                      Justificación legal (mínimo 20 caracteres)
                    </label>
                    <textarea
                      id="purge-justification"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      rows={3}
                      className="form-input mt-1 w-full text-sm"
                      placeholder="Documente la base legal de la supresión para auditoría"
                      disabled={purgeMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
                <button
                  type="button"
                  onClick={handlePurgeClose}
                  className="btn btn-secondary"
                  disabled={purgeMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePurgeConfirm}
                  disabled={purgeMutation.isPending}
                  className="btn btn-danger"
                >
                  {purgeMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Suprimiendo…
                    </span>
                  ) : (
                    'Confirmar supresión'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
