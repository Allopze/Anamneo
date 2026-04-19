'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { PatientAdminSummary } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiFileText,
  FiMapPin,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientSex,
  getPatientCompletenessMeta,
} from '@/lib/patient';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value?: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Sin registros';
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-surface-muted/35 bg-surface-elevated px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-2 text-sm text-ink">{value}</dd>
    </div>
  );
}

export default function PatientAdministrativeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace(`/pacientes/${id}`);
    }
  }, [id, router, user]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-admin-summary', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/admin-summary`);
      return response.data as PatientAdminSummary;
    },
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="h-8 skeleton rounded w-56 mb-6" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-28 skeleton rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/pacientes" className="btn btn-secondary inline-flex items-center gap-2">
            <FiArrowLeft className="w-4 h-4" />
            Volver a pacientes
          </Link>
        </div>
        <div className="card border-status-red/30 bg-status-red/10 text-status-red-text">
          <h1 className="text-lg font-semibold">No se pudo cargar la ficha administrativa</h1>
          <p className="mt-2 text-sm">{getErrorMessage(error)}</p>
        </div>
      </div>
    );
  }

  const displayRut = data.rutExempt
    ? `Sin RUT${data.rutExemptReason ? ` · ${data.rutExemptReason}` : ''}`
    : data.rut || 'Sin RUT registrado';
  const completenessMeta = getPatientCompletenessMeta(data);

  return (
    <div className="animate-fade-in pb-10">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 text-sm text-ink-secondary">
            <FiShield className="w-4 h-4" />
            <span>Ficha administrativa</span>
          </div>
          <h1 className="page-header-title mt-2">{data.nombre}</h1>
          <p className="page-header-description">
            Resumen operativo del paciente sin exponer historial ni contenido clínico.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`list-chip ${completenessMeta.badgeClassName}`}>{completenessMeta.label}</span>
            <span className="list-chip bg-surface-inset text-ink-secondary">{completenessMeta.registrationLabel}</span>
          </div>
        </div>
        <Link href="/pacientes" className="btn btn-secondary inline-flex items-center gap-2">
          <FiArrowLeft className="w-4 h-4" />
          Volver a pacientes
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="list-row-icon h-12 w-12 bg-surface-base text-ink-secondary">
              <FiUser className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Identificación y datos administrativos</h2>
              <p className="text-sm text-ink-secondary">Consulta rápida para soporte operativo y validación de registro.</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailField label="RUT" value={displayRut} />
            <DetailField label="Edad" value={formatPatientAge(data.edad, data.edadMeses)} />
            <DetailField label="Sexo" value={formatPatientSex(data.sexo)} />
            <DetailField label="Previsión" value={formatPatientPrevision(data.prevision)} />
            <DetailField label="Estado" value={completenessMeta.label} />
            <DetailField label="Trabajo" value={data.trabajo || 'No informado'} />
            <DetailField label="Domicilio" value={data.domicilio || 'No informado'} />
            <DetailField label="Centro médico" value={data.centroMedico || 'No informado'} />
          </dl>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Actividad operativa</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Señales útiles para soporte administrativo sin entrar al detalle clínico.
            </p>
          </div>

          <div className="rounded-card border border-surface-muted/35 bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FiFileText className="w-4 h-4 text-ink-secondary" />
              Atenciones registradas
            </div>
            <p className="mt-2 text-2xl font-semibold text-ink">{data.metrics.encounterCount}</p>
            <p className="mt-1 text-xs text-ink-muted">Última atención: {formatDateTime(data.metrics.lastEncounterAt)}</p>
          </div>

          <div className="rounded-card border border-surface-muted/35 bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FiCalendar className="w-4 h-4 text-ink-secondary" />
              Alta del registro
            </div>
            <p className="mt-2 text-sm text-ink">{formatDateTime(data.createdAt)}</p>
          </div>

          <div className="rounded-card border border-surface-muted/35 bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FiClock className="w-4 h-4 text-ink-secondary" />
              Última actualización administrativa
            </div>
            <p className="mt-2 text-sm text-ink">{formatDateTime(data.updatedAt)}</p>
          </div>

          <div className="rounded-card border border-surface-muted/35 bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <FiMapPin className="w-4 h-4 text-ink-secondary" />
              Registro creado por
            </div>
            <p className="mt-2 text-sm text-ink">{data.createdBy?.nombre || 'No disponible'}</p>
            <p className="mt-1 text-xs text-ink-muted">{data.createdBy?.email || 'Sin correo visible'}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
