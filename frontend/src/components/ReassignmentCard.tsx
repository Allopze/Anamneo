'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
import { FiRefreshCw, FiUserCheck } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';

interface ReassignmentCardProps {
  title: string;
  description: string;
  endpoint: string;
  targetLabel?: string;
  includeOpenEncountersOption?: boolean;
  allowClosedOverrideOption?: boolean;
  onSuccess?: () => void | Promise<void>;
}

type ReassignmentPayload = {
  targetMedicoId: string;
  reason: string;
  includeOpenEncounters?: boolean;
  allowClosedOverride?: boolean;
};

type ReassignmentMedico = {
  id: string;
  nombre: string;
  email?: string | null;
};

export default function ReassignmentCard({
  title,
  description,
  endpoint,
  targetLabel = 'ID del médico destino',
  includeOpenEncountersOption = false,
  allowClosedOverrideOption = false,
  onSuccess,
}: ReassignmentCardProps) {
  const [targetMedicoId, setTargetMedicoId] = useState('');
  const [reason, setReason] = useState('');
  const [includeOpenEncounters, setIncludeOpenEncounters] = useState(false);
  const [allowClosedOverride, setAllowClosedOverride] = useState(false);
  const medicosQuery = useQuery({
    queryKey: ['users', 'reassignment-medicos'],
    queryFn: async () => (await api.get('/users/reassignment-medicos')).data as ReassignmentMedico[],
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: ReassignmentPayload = {
        targetMedicoId: targetMedicoId.trim(),
        reason: reason.trim(),
      };
      if (includeOpenEncountersOption) payload.includeOpenEncounters = includeOpenEncounters;
      if (allowClosedOverrideOption) payload.allowClosedOverride = allowClosedOverride;
      return api.put(endpoint, payload);
    },
    onSuccess: async (response) => {
      const assignedMedicoName = (response.data as { assignedMedicoName?: string }).assignedMedicoName;
      notify.success(assignedMedicoName ? `Reasignado a ${assignedMedicoName}` : 'Reasignación completada');
      setTargetMedicoId('');
      setReason('');
      setIncludeOpenEncounters(false);
      setAllowClosedOverride(false);
      await onSuccess?.();
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const canSubmit = targetMedicoId.trim().length > 0 && reason.trim().length >= 10;

  return (
    <section className="rounded-card border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
      <div>
        <div className="flex items-center gap-2">
          <FiUserCheck className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-ink-primary">{title}</h2>
        </div>
        <p className="mt-1">{description}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <label className="form-label" htmlFor={`${endpoint}-target`}>
            {targetLabel}
          </label>
          {medicosQuery.data && medicosQuery.data.length > 0 ? (
            <select
              id={`${endpoint}-target`}
              value={targetMedicoId}
              onChange={(event) => setTargetMedicoId(event.target.value)}
              className="form-input"
            >
              <option value="">Seleccionar médico</option>
              {medicosQuery.data.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre}{medico.email ? ` (${medico.email})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${endpoint}-target`}
              value={targetMedicoId}
              onChange={(event) => setTargetMedicoId(event.target.value)}
              className="form-input font-mono text-xs"
              placeholder={medicosQuery.isLoading ? 'Cargando médicos...' : 'UUID del médico'}
            />
          )}
        </div>
        <div>
          <label className="form-label" htmlFor={`${endpoint}-reason`}>
            Motivo operativo
          </label>
          <input
            id={`${endpoint}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="form-input"
            placeholder="Ej: cobertura por agenda clínica"
          />
        </div>
      </div>

      {(includeOpenEncountersOption || allowClosedOverrideOption) && (
        <div className="mt-3 flex flex-wrap gap-3">
          {includeOpenEncountersOption && (
            <label className="inline-flex items-center gap-2 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={includeOpenEncounters}
                onChange={(event) => setIncludeOpenEncounters(event.target.checked)}
                className="h-4 w-4 rounded border-surface-muted"
              />
              Mover también atenciones abiertas
            </label>
          )}
          {allowClosedOverrideOption && (
            <label className="inline-flex items-center gap-2 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={allowClosedOverride}
                onChange={(event) => setAllowClosedOverride(event.target.checked)}
                className="h-4 w-4 rounded border-surface-muted"
              />
              Permitir cerradas si soy admin
            </label>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-muted">El cambio queda auditado con el motivo ingresado.</p>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="btn btn-secondary flex items-center gap-2"
        >
          <FiRefreshCw className={mutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {mutation.isPending ? 'Reasignando...' : 'Reasignar'}
        </button>
      </div>
    </section>
  );
}
