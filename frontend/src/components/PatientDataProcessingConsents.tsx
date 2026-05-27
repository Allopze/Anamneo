'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

/**
 * Consentimiento del titular para el TRATAMIENTO DE DATOS PERSONALES
 * (Ley 21.719 Art 12). Separado del consentimiento clinico tipico
 * (PatientConsents.tsx), porque la base juridica y los actores son
 * distintos: aqui el otorgante es el TITULAR o su REPRESENTANTE LEGAL,
 * no el medico.
 *
 * Aplica adicionalmente Art 16 quater (NNA): cuando el paciente es
 * menor de 16 anos, signerRelationship debe ser PADRE/MADRE/TUTOR/REPRESENTANTE.
 * El backend valida esto y rechaza si signerRelationship=TITULAR.
 */

const PURPOSES = [
  { value: 'ATENCION_CLINICA', label: 'Atención clínica (obligatorio)' },
  { value: 'ANALITICA_INTERNA', label: 'Analítica interna' },
  { value: 'COMUNICACIONES', label: 'Comunicaciones no esenciales' },
  { value: 'INVESTIGACION', label: 'Investigación' },
] as const;

const METHODS = [
  { value: 'PRESENCIAL_TABLET', label: 'Presencial (tablet)' },
  { value: 'WEB_TITULAR', label: 'Web (titular)' },
  { value: 'REPRESENTANTE', label: 'Vía representante' },
] as const;

const SIGNER_RELATIONSHIPS = [
  { value: 'TITULAR', label: 'Titular' },
  { value: 'PADRE', label: 'Padre' },
  { value: 'MADRE', label: 'Madre' },
  { value: 'TUTOR', label: 'Tutor legal' },
  { value: 'REPRESENTANTE', label: 'Otro representante legal' },
] as const;

const REVOKE_CHANNELS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'WEB_TITULAR', label: 'Web (titular)' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'DPO', label: 'Vía DPO' },
] as const;

const MIN_REVOKE_REASON_LENGTH = 20;

interface LegalDocument {
  id: string;
  type: string;
  version: string;
  title: string;
}

interface DataProcessingConsent {
  id: string;
  patientId: string;
  legalDocumentId: string;
  purpose: string;
  granted: boolean;
  grantedAt: string;
  revokedAt: string | null;
  method: string;
  signerName: string;
  signerRut: string | null;
  signerRelationship: string;
  evidenceHash: string;
  legalDocument?: LegalDocument | null;
  capturedBy?: { id: string; nombre: string } | null;
}

interface Props {
  patientId: string;
  patientAgeYears?: number | null;
}

function purposeLabel(value: string): string {
  return PURPOSES.find((p) => p.value === value)?.label ?? value;
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: es });
}

export default function PatientDataProcessingConsents({ patientId, patientAgeYears }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [revokeConsent, setRevokeConsent] = useState<DataProcessingConsent | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeChannel, setRevokeChannel] = useState<typeof REVOKE_CHANNELS[number]['value']>('PRESENCIAL');

  const isMinor16 = patientAgeYears != null && patientAgeYears < 16;
  const isMinor14 = patientAgeYears != null && patientAgeYears < 14;

  const [form, setForm] = useState({
    legalDocumentId: '',
    purpose: 'ATENCION_CLINICA' as typeof PURPOSES[number]['value'],
    method: 'PRESENCIAL_TABLET' as typeof METHODS[number]['value'],
    signerName: '',
    signerRut: '',
    signerRelationship: 'TITULAR' as typeof SIGNER_RELATIONSHIPS[number]['value'],
  });

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ['patient-data-processing-consents', patientId],
    queryFn: async () => {
      const res = await api.get<DataProcessingConsent[]>(`/patient-consents/patient/${patientId}`);
      return res.data;
    },
  });

  const { data: activeLegal } = useQuery({
    queryKey: ['active-privacy-policy'],
    queryFn: async () => {
      const res = await api.get<LegalDocument & { contentJson: unknown }>('/legal/published/PRIVACY');
      if (res.data && form.legalDocumentId === '') {
        setForm((f) => ({ ...f, legalDocumentId: res.data.id }));
      }
      return res.data;
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      return api.post('/patient-consents/grant', {
        patientId,
        legalDocumentId: form.legalDocumentId,
        purpose: form.purpose,
        method: form.method,
        signerName: form.signerName.trim(),
        signerRut: form.signerRut.trim() || undefined,
        signerRelationship: form.signerRelationship,
      });
    },
    onSuccess: () => {
      toast.success('Consentimiento registrado');
      queryClient.invalidateQueries({ queryKey: ['patient-data-processing-consents', patientId] });
      setShowForm(false);
      setForm({
        ...form,
        signerName: '',
        signerRut: '',
        signerRelationship: isMinor16 ? 'PADRE' : 'TITULAR',
      });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!revokeConsent) return;
      return api.post(`/patient-consents/${revokeConsent.id}/revoke`, {
        reason: revokeReason.trim(),
        channel: revokeChannel,
      });
    },
    onSuccess: () => {
      toast.success('Consentimiento revocado');
      queryClient.invalidateQueries({ queryKey: ['patient-data-processing-consents', patientId] });
      setRevokeConsent(null);
      setRevokeReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleCloseRevoke = () => {
    if (revokeMutation.isPending) return;
    setRevokeConsent(null);
    setRevokeReason('');
  };

  const handleConfirmRevoke = () => {
    if (revokeReason.trim().length < MIN_REVOKE_REASON_LENGTH) {
      toast.error(`El motivo debe tener al menos ${MIN_REVOKE_REASON_LENGTH} caracteres`);
      return;
    }
    revokeMutation.mutate();
  };

  return (
    <section className="rounded-card border border-surface-muted/30 bg-surface-elevated p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Ley 21.719 — Art 12
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">
            Consentimiento del titular para tratamiento de datos personales
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Distinto del consentimiento clínico (procedimientos, intervenciones).
            Este consentimiento autoriza el tratamiento de los datos personales
            bajo la política de privacidad vigente.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              if (isMinor16) {
                setForm((f) => ({ ...f, signerRelationship: 'PADRE' }));
              }
            }}
            className="btn btn-primary text-sm"
          >
            + Capturar consentimiento
          </button>
        )}
      </header>

      {isMinor16 && (
        <div className="mb-4 rounded-card border border-status-yellow/65 bg-status-yellow/20 p-3 text-xs text-accent-text">
          ⚠ Paciente menor de 16 años. El consentimiento sobre datos sensibles
          debe ser otorgado por <strong>padre, madre, tutor o representante legal</strong>.
          {isMinor14 && ' Para menores de 14 años esto aplica también a datos no sensibles.'}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.legalDocumentId || !form.signerName.trim()) {
              toast.error('Selecciona política y nombre del firmante');
              return;
            }
            grantMutation.mutate();
          }}
          className="mb-6 space-y-3 rounded-card border border-surface-muted/30 bg-surface-base/40 p-4 text-sm"
        >
          <div>
            <label className="form-label text-xs">Política de privacidad vigente</label>
            <div className="mt-1 rounded-input border border-surface-muted/30 bg-surface-elevated px-2 py-1 text-xs text-ink-secondary">
              {activeLegal ? `${activeLegal.title} (v${activeLegal.version})` : 'Cargando…'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs">Finalidad</label>
              <select
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value as typeof form.purpose })}
                className="form-input mt-1 text-xs"
              >
                {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Método de captura</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })}
                className="form-input mt-1 text-xs"
              >
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs">Nombre del firmante</label>
              <input
                value={form.signerName}
                onChange={(e) => setForm({ ...form, signerName: e.target.value })}
                className="form-input mt-1 text-xs"
                placeholder="Quien firma el consentimiento"
              />
            </div>
            <div>
              <label className="form-label text-xs">RUT del firmante (opcional)</label>
              <input
                value={form.signerRut}
                onChange={(e) => setForm({ ...form, signerRut: e.target.value })}
                className="form-input mt-1 text-xs"
                placeholder="12.345.678-9"
              />
            </div>
          </div>
          <div>
            <label className="form-label text-xs">Relación del firmante con el titular</label>
            <select
              value={form.signerRelationship}
              onChange={(e) => setForm({ ...form, signerRelationship: e.target.value as typeof form.signerRelationship })}
              className="form-input mt-1 text-xs"
            >
              {SIGNER_RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value} disabled={isMinor16 && r.value === 'TITULAR'}>
                  {r.label} {isMinor16 && r.value === 'TITULAR' ? '(no permitido para menores de 16)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-xs">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={grantMutation.isPending}
              className="btn btn-primary text-xs"
            >
              {grantMutation.isPending ? 'Guardando…' : 'Registrar consentimiento'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-ink-muted">Cargando consentimientos…</p>
      ) : consents.length === 0 ? (
        <p className="rounded-card border border-dashed border-surface-muted/50 bg-surface-base/30 p-4 text-xs text-ink-muted">
          No hay consentimientos de tratamiento de datos personales registrados para este paciente.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {consents.map((c) => (
            <li
              key={c.id}
              className={`rounded-card border p-3 ${c.revokedAt ? 'border-status-red/20 bg-status-red/10' : 'border-status-green/30 bg-status-green/10'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-ink-primary">
                    {purposeLabel(c.purpose)}
                    {c.revokedAt ? ' — REVOCADO' : ' — Vigente'}
                  </p>
                  <p className="text-xs text-ink-secondary">
                    Firmante: {c.signerName} ({c.signerRelationship}) · método {c.method}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Otorgado: {fmtDate(c.grantedAt)} hrs
                    {c.revokedAt ? ` · Revocado: ${fmtDate(c.revokedAt)} hrs` : ''}
                  </p>
                  {c.legalDocument && (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                      Política: {c.legalDocument.title} v{c.legalDocument.version}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-ink-muted">hash: {c.evidenceHash.slice(0, 16)}…</p>
                </div>
                {!c.revokedAt && (
                  <button
                    type="button"
                    onClick={() => setRevokeConsent(c)}
                    className="text-xs text-status-red underline hover:no-underline"
                  >
                    Revocar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revokeConsent && (
        <>
          <div
            className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm"
            onClick={handleCloseRevoke}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="revoke-modal-title"
              aria-describedby="revoke-modal-desc"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-red/20 text-status-red">
                    <FiAlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 id="revoke-modal-title" className="text-lg font-semibold text-ink-primary">
                      Revocar consentimiento
                    </h3>
                    <p id="revoke-modal-desc" className="mt-1 text-sm text-ink-secondary">
                      La revocación detiene el tratamiento basado en este consentimiento.
                      No implica supresión automática cuando exista obligación legal de
                      conservación (ej. ficha clínica sanitaria).
                    </p>
                  </div>
                  <button
                    onClick={handleCloseRevoke}
                    disabled={revokeMutation.isPending}
                    className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                    aria-label="Cerrar"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                {/* Evidence preview — shows what is being revoked */}
                <div className="mt-4 rounded-card border border-status-red/20 bg-status-red/5 p-3 text-xs space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide text-status-red">
                    Acto legal que se revoca
                  </p>
                  <p className="text-ink-primary">
                    <span className="font-medium">Finalidad:</span> {purposeLabel(revokeConsent.purpose)}
                  </p>
                  <p className="text-ink-secondary">
                    <span className="font-medium">Firmante:</span> {revokeConsent.signerName}
                    {revokeConsent.signerRut ? ` · RUT ${revokeConsent.signerRut}` : ''}
                    {' '}({revokeConsent.signerRelationship})
                  </p>
                  <p className="text-ink-secondary">
                    <span className="font-medium">Otorgado:</span> {fmtDate(revokeConsent.grantedAt)} hrs
                  </p>
                  {revokeConsent.legalDocument && (
                    <p className="text-ink-muted">
                      <span className="font-medium">Política:</span> {revokeConsent.legalDocument.title} v{revokeConsent.legalDocument.version}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-ink-muted">
                    Hash de evidencia: {revokeConsent.evidenceHash.slice(0, 24)}…
                  </p>
                </div>

                <label className="mt-4 block text-sm font-medium text-ink-primary" htmlFor="revoke-reason">
                  Motivo de revocación (mínimo {MIN_REVOKE_REASON_LENGTH} caracteres)
                </label>
                <textarea
                  id="revoke-reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  className="form-input mt-1 w-full text-sm"
                  placeholder="Documente el motivo completo para auditoría regulatoria"
                  disabled={revokeMutation.isPending}
                />
                <p className="mt-0.5 text-right text-[10px] text-ink-muted">
                  {revokeReason.trim().length}/{MIN_REVOKE_REASON_LENGTH} caracteres mín.
                </p>

                <div className="mt-2">
                  <label className="form-label text-sm" htmlFor="revoke-channel">Canal de revocación</label>
                  <select
                    id="revoke-channel"
                    value={revokeChannel}
                    onChange={(e) => setRevokeChannel(e.target.value as typeof revokeChannel)}
                    disabled={revokeMutation.isPending}
                    className="form-input mt-1 text-sm"
                  >
                    {REVOKE_CHANNELS.map((ch) => (
                      <option key={ch.value} value={ch.value}>{ch.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-card border-t border-surface-muted/30 bg-surface-base/40 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseRevoke}
                  disabled={revokeMutation.isPending}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={revokeMutation.isPending}
                  className="btn btn-danger"
                >
                  {revokeMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Revocando…
                    </span>
                  ) : (
                    'Confirmar revocación'
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
