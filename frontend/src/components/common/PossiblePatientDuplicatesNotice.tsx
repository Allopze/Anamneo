'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';

type PossiblePatientDuplicate = {
  id: string;
  nombre: string;
  rut: string | null;
  fechaNacimiento: string | null;
  registrationMode: string;
  completenessStatus: string;
  matchReasons: Array<'same_rut' | 'same_name_birth_date'>;
};

type PossiblePatientDuplicatesNoticeProps = {
  nombre?: string | null;
  fechaNacimiento?: string | null;
  rut?: string | null;
  rutExempt?: boolean;
  excludePatientId?: string;
  className?: string;
  resolutionAction?: {
    label: string;
    helperText?: string;
    onClick: () => void;
  };
};

const REASON_LABELS: Record<PossiblePatientDuplicate['matchReasons'][number], string> = {
  same_rut: 'RUT coincidente',
  same_name_birth_date: 'Nombre y fecha de nacimiento coinciden',
};

export function PossiblePatientDuplicatesNotice(props: PossiblePatientDuplicatesNoticeProps) {
  const deferredNombre = useDeferredValue((props.nombre || '').trim());
  const deferredFechaNacimiento = useDeferredValue((props.fechaNacimiento || '').trim());
  const deferredRut = useDeferredValue(props.rutExempt ? '' : (props.rut || '').trim());
  const requestIdRef = useRef(0);
  const [duplicates, setDuplicates] = useState<PossiblePatientDuplicate[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const shouldCheck =
    deferredRut.length > 0 || (deferredNombre.length >= 3 && deferredFechaNacimiento.length > 0);

  useEffect(() => {
    if (!shouldCheck) {
      setDuplicates([]);
      setStatus('idle');
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setStatus('loading');

    void api
      .get('/patients/possible-duplicates', {
        params: {
          nombre: deferredNombre || undefined,
          fechaNacimiento: deferredFechaNacimiento || undefined,
          rut: deferredRut || undefined,
          excludePatientId: props.excludePatientId || undefined,
        },
      })
      .then((response) => {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setDuplicates(response.data?.data || []);
        setStatus('success');
      })
      .catch(() => {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setStatus('error');
      });
  }, [deferredFechaNacimiento, deferredNombre, deferredRut, props.excludePatientId, shouldCheck]);

  if (!shouldCheck) {
    return null;
  }

  if (status === 'loading' && duplicates.length === 0) {
    return <p className="text-sm text-ink-muted">Buscando posibles pacientes duplicados...</p>;
  }

  if (status === 'error' && duplicates.length === 0) {
    return (
      <div className="rounded-xl border border-status-yellow/70 bg-status-yellow/30 px-4 py-3 text-sm text-accent-text">
        No se pudo verificar posibles duplicados en este momento.
      </div>
    );
  }

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <div className={clsx('rounded-2xl border border-status-yellow/70 bg-status-yellow/30 p-4 text-sm text-accent-text', props.className)}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-primary">Posibles pacientes duplicados</p>
          <p className="text-xs text-accent-text">
            Revisa estas fichas antes de crear o guardar cambios para evitar registros repetidos.
          </p>
        </div>
        {status === 'loading' && <span className="text-xs text-ink-muted">Actualizando verificación...</span>}
      </div>

      {props.resolutionAction && (
        <div className="mt-3 rounded-xl border border-status-yellow/80 bg-white/70 px-4 py-3">
          <p className="font-medium text-ink-primary">Si confirmas que esta ficha sobra, archívala desde aquí.</p>
          {props.resolutionAction.helperText && (
            <p className="mt-1 text-xs text-ink-secondary">{props.resolutionAction.helperText}</p>
          )}
          <button type="button" className="btn btn-secondary mt-3 text-xs" onClick={props.resolutionAction.onClick}>
            {props.resolutionAction.label}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {duplicates.map((duplicate) => (
          <div
            key={duplicate.id}
            className="rounded-xl border border-status-yellow/80 bg-white/80 px-4 py-3 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-ink-primary">{duplicate.nombre}</p>
                <p className="text-xs text-ink-secondary">
                  {duplicate.rut ? `RUT ${duplicate.rut}` : 'Sin RUT'}
                  {duplicate.fechaNacimiento ? ` · ${formatDateOnly(duplicate.fechaNacimiento)}` : ''}
                </p>
              </div>
              <Link href={`/pacientes/${duplicate.id}`} className="btn btn-secondary text-xs">
                Abrir ficha
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {duplicate.matchReasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-status-yellow/80 bg-status-yellow/20 px-2.5 py-1 text-xs font-medium text-accent-text"
                >
                  {REASON_LABELS[reason]}
                </span>
              ))}
              <span className="rounded-full border border-surface-muted/50 bg-surface-elevated px-2.5 py-1 text-xs text-ink-secondary">
                {duplicate.registrationMode === 'RAPIDO' ? 'Registro rápido' : 'Registro completo'}
              </span>
              <span className="rounded-full border border-surface-muted/50 bg-surface-elevated px-2.5 py-1 text-xs text-ink-secondary">
                {duplicate.completenessStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PossiblePatientDuplicatesNotice;