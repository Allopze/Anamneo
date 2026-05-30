'use client';

import { AlertBanner } from '@/components/common/AlertBanner';
import { EmptyState } from '@/components/common/EmptyState';
import { STATUS_FILTERS } from './solicitudes.types';
import { useSolicitudes } from './useSolicitudes';
import { SolicitudDetailDialog } from './solicitudes.parts';
import { SolicitudDecisionDialog } from './SolicitudDecisionDialog';

export default function SolicitudesAdminPage() {
  const {
    items,
    status,
    setStatus,
    loading,
    error,
    selected,
    setSelected,
    patientId,
    setPatientId,
    identityVerificationMethod,
    setIdentityVerificationMethod,
    identityEvidence,
    setIdentityEvidence,
    exportLink,
    pendingDecision,
    setPendingDecision,
    decisionNote,
    setDecisionNote,
    decisionError,
    decisionSubmitting,
    decisionCancelRef,
    selectedCloseRef,
    selectedExportDelivery,
    openDecision,
    handleMarkInReview,
    handleSaveVerification,
    handleGenerateExportLink,
    handleSubmitDecision,
  } = useSolicitudes();

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

      {error && <AlertBanner variant="error" message={error} />}

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

      <SolicitudDetailDialog
        selected={selected}
        selectedCloseRef={selectedCloseRef}
        selectedExportDelivery={selectedExportDelivery}
        exportLink={exportLink}
        patientId={patientId}
        identityVerificationMethod={identityVerificationMethod}
        identityEvidence={identityEvidence}
        onClose={() => setSelected(null)}
        onPatientIdChange={setPatientId}
        onIdentityVerificationMethodChange={setIdentityVerificationMethod}
        onIdentityEvidenceChange={setIdentityEvidence}
        onSaveVerification={handleSaveVerification}
        onMarkInReview={handleMarkInReview}
        onGenerateExportLink={handleGenerateExportLink}
        openDecision={openDecision}
      />

      <SolicitudDecisionDialog
        pendingDecision={pendingDecision}
        decisionNote={decisionNote}
        decisionError={decisionError}
        decisionSubmitting={decisionSubmitting}
        decisionCancelRef={decisionCancelRef}
        onDecisionNoteChange={(v) => {
          setDecisionNote(v);
        }}
        onSubmit={handleSubmitDecision}
        onCancel={() => {
          setPendingDecision(null);
          setDecisionNote('');
        }}
      />
    </div>
  );
}
