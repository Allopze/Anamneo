'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export default function PatientDataProcessingConsents({ patientId, patientAgeYears }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeChannel, setRevokeChannel] = useState<'WEB_TITULAR' | 'PRESENCIAL' | 'EMAIL' | 'DPO'>('PRESENCIAL');

  // Sugerencia automatica del signerRelationship segun edad del paciente.
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
      if (!revokeId) return;
      return api.post(`/patient-consents/${revokeId}/revoke`, {
        reason: revokeReason.trim(),
        channel: revokeChannel,
      });
    },
    onSuccess: () => {
      toast.success('Consentimiento revocado');
      queryClient.invalidateQueries({ queryKey: ['patient-data-processing-consents', patientId] });
      setRevokeId(null);
      setRevokeReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-700">
            Ley 21.719 — Art 12
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Consentimiento del titular para tratamiento de datos personales
          </h2>
          <p className="mt-1 text-xs text-slate-500">
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
            className="rounded-md bg-teal-700 px-3 py-1 text-sm text-white hover:bg-teal-800"
          >
            + Capturar consentimiento
          </button>
        )}
      </header>

      {isMinor16 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
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
          className="mb-6 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700">Política de privacidad vigente</label>
            <div className="mt-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              {activeLegal ? `${activeLegal.title} (v${activeLegal.version})` : 'Cargando…'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Finalidad</label>
              <select
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value as typeof form.purpose })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Método de captura</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Nombre del firmante</label>
              <input
                value={form.signerName}
                onChange={(e) => setForm({ ...form, signerName: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="Quien firma el consentimiento"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">RUT del firmante (opcional)</label>
              <input
                value={form.signerRut}
                onChange={(e) => setForm({ ...form, signerRut: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="12.345.678-9"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Relación del firmante con el titular</label>
            <select
              value={form.signerRelationship}
              onChange={(e) => setForm({ ...form, signerRelationship: e.target.value as typeof form.signerRelationship })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            >
              {SIGNER_RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value} disabled={isMinor16 && r.value === 'TITULAR'}>
                  {r.label} {isMinor16 && r.value === 'TITULAR' ? '(no permitido para menores de 16)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-slate-600 underline">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={grantMutation.isPending}
              className="rounded bg-teal-700 px-3 py-1 text-xs text-white disabled:opacity-50"
            >
              {grantMutation.isPending ? 'Guardando…' : 'Registrar consentimiento'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-500">Cargando consentimientos…</p>
      ) : consents.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
          No hay consentimientos de tratamiento de datos personales registrados para este paciente.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {consents.map((c) => (
            <li
              key={c.id}
              className={`rounded border p-3 ${c.revokedAt ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {PURPOSES.find((p) => p.value === c.purpose)?.label ?? c.purpose}
                    {c.revokedAt ? ' — REVOCADO' : ' — Vigente'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Firmante: {c.signerName} ({c.signerRelationship}) · método {c.method}
                  </p>
                  <p className="text-xs text-slate-500">
                    Otorgado: {format(new Date(c.grantedAt), "d MMM yyyy HH:mm", { locale: es })}
                    {c.revokedAt
                      ? ` · Revocado: ${format(new Date(c.revokedAt), 'd MMM yyyy HH:mm', { locale: es })}`
                      : ''}
                  </p>
                  {c.legalDocument && (
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      Política: {c.legalDocument.title} v{c.legalDocument.version}
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-slate-400">hash: {c.evidenceHash.slice(0, 16)}…</p>
                </div>
                {!c.revokedAt && (
                  <button
                    type="button"
                    onClick={() => setRevokeId(c.id)}
                    className="text-xs text-rose-700 underline"
                  >
                    Revocar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Revocar consentimiento</h3>
            <p className="mt-1 text-xs text-slate-500">
              La revocación detiene el tratamiento basado en consentimiento.
              No implica supresión automática cuando exista obligación legal de
              conservación (ej. ficha clínica sanitaria).
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-700">Motivo</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Indique el motivo de la revocación"
            />
            <label className="mt-2 block text-xs font-medium text-slate-700">Canal de revocación</label>
            <select
              value={revokeChannel}
              onChange={(e) => setRevokeChannel(e.target.value as typeof revokeChannel)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="PRESENCIAL">Presencial</option>
              <option value="WEB_TITULAR">Web (titular)</option>
              <option value="EMAIL">Email</option>
              <option value="DPO">Vía DPO</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRevokeId(null)} className="text-xs text-slate-600 underline">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (revokeReason.trim().length < 2) {
                    toast.error('Motivo requerido');
                    return;
                  }
                  revokeMutation.mutate();
                }}
                disabled={revokeMutation.isPending}
                className="rounded bg-rose-700 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {revokeMutation.isPending ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
