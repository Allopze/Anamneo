'use client';

import { METHODS, PURPOSES, SIGNER_RELATIONSHIPS } from './constants';
import { GrantConsentFormState, LegalDocument } from './types';

interface Props {
  activeLegal?: (LegalDocument & { contentJson: unknown }) | null;
  form: GrantConsentFormState;
  isMinor16: boolean;
  isPending: boolean;
  onCancel: () => void;
  onChange: (form: GrantConsentFormState) => void;
  onSubmit: () => void;
}

export default function GrantConsentForm({
  activeLegal,
  form,
  isMinor16,
  isPending,
  onCancel,
  onChange,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
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
            onChange={(e) => onChange({ ...form, purpose: e.target.value as typeof form.purpose })}
            className="form-input mt-1 text-xs"
          >
            {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label text-xs">Método de captura</label>
          <select
            value={form.method}
            onChange={(e) => onChange({ ...form, method: e.target.value as typeof form.method })}
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
            onChange={(e) => onChange({ ...form, signerName: e.target.value })}
            className="form-input mt-1 text-xs"
            placeholder="Quien firma el consentimiento"
          />
        </div>
        <div>
          <label className="form-label text-xs">RUT del firmante (opcional)</label>
          <input
            value={form.signerRut}
            onChange={(e) => onChange({ ...form, signerRut: e.target.value })}
            className="form-input mt-1 text-xs"
            placeholder="12.345.678-9"
          />
        </div>
      </div>
      <div>
        <label className="form-label text-xs">Relación del firmante con el titular</label>
        <select
          value={form.signerRelationship}
          onChange={(e) => onChange({ ...form, signerRelationship: e.target.value as typeof form.signerRelationship })}
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
        <button type="button" onClick={onCancel} className="btn btn-secondary text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
          {isPending ? 'Guardando…' : 'Registrar consentimiento'}
        </button>
      </div>
    </form>
  );
}
