'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthUser } from '@/stores/auth-store';
import { isMedicoUser } from '@/lib/permissions';
import { FiFileText, FiPlus, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CONSENT_TYPES = [
  { value: 'TRATAMIENTO', label: 'Tratamiento' },
  { value: 'DATOS_PERSONALES', label: 'Datos personales' },
  { value: 'PROCEDIMIENTO', label: 'Procedimiento' },
  { value: 'INVESTIGACION', label: 'Investigación' },
] as const;

const REVOKED_PAGE_SIZE = 20;

interface Consent {
  id: string;
  type: string;
  description: string;
  status: string;
  encounterId?: string | null;
  grantedAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  grantedBy?: { nombre: string } | null;
}

interface ConsentsResponse {
  data: Consent[];
  meta?: {
    revokedHasMore?: boolean;
  };
}

interface PatientConsentsProps {
  patientId: string;
  encounterId?: string;
}

export default function PatientConsents({ patientId, encounterId }: PatientConsentsProps) {
  const queryClient = useQueryClient();
  const user = useAuthUser();
  const isMedico = isMedicoUser(user);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'TRATAMIENTO', description: '' });
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokedLimit, setRevokedLimit] = useState(REVOKED_PAGE_SIZE);

  const { data: consentsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['consents', patientId, revokedLimit],
    queryFn: async () => {
      const res = await api.get(`/consents/patient/${patientId}?revokedLimit=${revokedLimit}&withMeta=true`);
      return res.data as ConsentsResponse;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/consents', {
        patientId,
        encounterId: encounterId || undefined,
        type: form.type,
        description: form.description,
      });
    },
    onSuccess: () => {
      toast.success('Consentimiento registrado');
      setShowForm(false);
      setForm({ type: 'TRATAMIENTO', description: '' });
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/consents/${id}/revoke`, { reason: revokeReason });
    },
    onSuccess: () => {
      toast.success('Consentimiento revocado');
      setRevokeId(null);
      setRevokeReason('');
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const consents = consentsResponse?.data ?? [];
  const activeConsents = consents.filter((c) => c.status === 'ACTIVO');
  const revokedConsents = consents.filter((c) => c.status === 'REVOCADO');
  const revokedHasMore = Boolean(consentsResponse?.meta?.revokedHasMore);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Registro de consentimientos</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Bitácora simple de consentimientos registrados y revocados dentro de la ficha del paciente.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          <FiPlus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-card border border-surface-muted/40 bg-surface-elevated p-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="consent-type" className="block text-sm font-medium text-ink-secondary mb-1">
                Tipo de consentimiento
              </label>
              <select
                id="consent-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input w-full"
              >
                {CONSENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="consent-desc" className="block text-sm font-medium text-ink-secondary mb-1">
                Descripción
              </label>
              <textarea
                id="consent-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input w-full min-h-[80px]"
                placeholder="Describe qué se explicó, qué aceptó el paciente y cualquier contexto relevante..."
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.description.trim() || createMutation.isPending}
                className="btn btn-primary text-sm"
              >
                {createMutation.isPending ? 'Registrando...' : 'Registrar consentimiento'}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm({ type: 'TRATAMIENTO', description: '' }); }}
                className="btn btn-secondary text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-ink-muted py-4 text-center">Cargando...</div>
      ) : consents.length === 0 ? (
        <div className="text-sm text-ink-muted py-4 text-center">
          <FiFileText className="mx-auto h-8 w-8 mb-2 text-ink-muted/50" />
          No hay consentimientos registrados
        </div>
      ) : (
        <div className="space-y-3">
          {activeConsents.map((consent) => (
            <div key={consent.id} className="rounded-card border border-surface-muted/40 bg-surface-elevated p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-status-green/20 px-2 py-0.5 text-xs font-semibold text-status-green-text">
                      {CONSENT_TYPES.find((ct) => ct.value === consent.type)?.label || consent.type}
                    </span>
                    <span className="text-xs text-ink-muted">
                      Otorgado {format(new Date(consent.grantedAt || consent.createdAt), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{consent.description}</p>
                  {consent.encounterId && (
                    <p className="mt-1 text-xs text-ink-muted">Asociado a la atención {consent.encounterId}</p>
                  )}
                  {consent.grantedBy && (
                    <p className="mt-1 text-xs text-ink-muted">Registrado por {consent.grantedBy.nombre}</p>
                  )}
                </div>
                {isMedico && (
                  revokeId === consent.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={revokeReason}
                        onChange={(e) => setRevokeReason(e.target.value)}
                        placeholder="Motivo de revocación"
                        className="input text-sm"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => revokeMutation.mutate(consent.id)}
                          disabled={!revokeReason.trim() || revokeMutation.isPending}
                          className="btn btn-secondary text-xs text-status-red-text"
                        >
                          Confirmar
                        </button>
                        <button onClick={() => setRevokeId(null)} className="btn btn-secondary text-xs">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeId(consent.id)}
                      className="text-ink-muted hover:text-status-red-text transition-colors"
                      title="Revocar consentimiento"
                    >
                      <FiXCircle className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
          {revokedConsents.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                Últimos consentimientos revocados ({revokedConsents.length})
              </summary>
              <div className="mt-2 space-y-2">
                {revokedConsents.map((consent) => (
                  <div key={consent.id} className="rounded-card border border-surface-muted/30 bg-surface-base/40 p-3 opacity-70">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-semibold text-status-red-text line-through">
                        {CONSENT_TYPES.find((ct) => ct.value === consent.type)?.label || consent.type}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Revocado {consent.revokedAt ? format(new Date(consent.revokedAt), "d MMM yyyy", { locale: es }) : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{consent.description}</p>
                    {consent.revokeReason && (
                      <p className="mt-1 text-xs text-ink-muted italic">Motivo: {consent.revokeReason}</p>
                    )}
                  </div>
                ))}
                {revokedHasMore ? (
                  <button
                    type="button"
                    className="btn btn-secondary mt-2 w-full text-sm"
                    onClick={() => setRevokedLimit((current) => current + REVOKED_PAGE_SIZE)}
                    disabled={isFetching}
                  >
                    {isFetching ? 'Cargando...' : 'Ver más consentimientos revocados'}
                  </button>
                ) : null}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
