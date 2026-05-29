'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { FiDownload, FiFileText } from 'react-icons/fi';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

type PortalPatient = {
  id: string;
  nombre: string;
  rut: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  prevision: string | null;
};

type PortalEncounter = {
  id: string;
  fecha: string;
  status: string;
  tipoAtencion: string | null;
  motivoConsulta: string | null;
  medico?: { nombre: string } | null;
};

export default function PortalHomePage() {
  const [patientQuery, encountersQuery] = useQueries({
    queries: [
      {
        queryKey: ['portal', 'patient'],
        queryFn: async () => (await portalApi.get<PortalPatient>('/portal/patient')).data,
        retry: false,
      },
      {
        queryKey: ['portal', 'encounters'],
        queryFn: async () => (await portalApi.get<PortalEncounter[]>('/portal/encounters')).data,
        retry: false,
      },
    ],
  });

  const isLoading = patientQuery.isLoading || encountersQuery.isLoading;
  const error = patientQuery.error ?? encountersQuery.error;
  const patient = patientQuery.data ?? null;
  const encounters = encountersQuery.data ?? [];

  const handleLogout = async () => {
    await portalApi.post('/portal/auth/logout', {});
    window.location.href = '/portal/login';
  };

  return (
    <main className="portal-page">
      <div className="portal-container">
        {isLoading && (
          <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true" aria-label="Cargando tu información">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-muted border-t-frame" />
              <p className="portal-muted">Cargando tu información…</p>
            </div>
          </div>
        )}
        {!isLoading && (
        <>
        <header className="portal-header">
          <div>
            <h1 className="portal-title">Portal paciente</h1>
            <p className="portal-copy">{patient ? patient.nombre : '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/solicitudes" className="portal-button-secondary">
              Solicitudes
            </Link>
            <Link href="/portal/historial-acceso" className="portal-button-secondary">
              Historial de accesos
            </Link>
            <button onClick={handleLogout} className="portal-button-primary">
              Salir
            </button>
          </div>
        </header>

        {error && <div className="portal-alert-error">{getErrorMessage(error)}</div>}

        {patient && (
          <section className="portal-card">
            <h2 className="text-lg font-semibold text-ink">Datos generales</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-ink-muted">RUT</dt><dd>{patient.rut ?? 'Sin RUT'}</dd></div>
              <div><dt className="text-ink-muted">Nacimiento</dt><dd>{patient.fechaNacimiento ? new Date(patient.fechaNacimiento).toLocaleDateString('es-CL') : '—'}</dd></div>
              <div><dt className="text-ink-muted">Sexo</dt><dd>{patient.sexo ?? '—'}</dd></div>
              <div><dt className="text-ink-muted">Previsión</dt><dd>{patient.prevision ?? '—'}</dd></div>
            </dl>
          </section>
        )}

        <section className="portal-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Atenciones finalizadas</h2>
            <FiFileText className="h-5 w-5 text-ink-muted" />
          </div>
          <div className="divide-y divide-surface-muted/70">
            {encounters.map((encounter) => (
              <Link key={encounter.id} href={`/portal/atenciones/${encounter.id}`} className="flex items-center justify-between gap-4 rounded-lg py-3 transition-colors hover:bg-surface-inset">
                <div>
                  <p className="font-medium text-ink">{encounter.motivoConsulta || encounter.tipoAtencion || 'Atención clínica'}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(encounter.fecha).toLocaleDateString('es-CL')} · {encounter.medico?.nombre ?? 'Equipo clínico'} · {encounter.status}
                  </p>
                </div>
                <FiDownload className="h-4 w-4 text-ink-muted" />
              </Link>
            ))}
            {encounters.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No hay atenciones finalizadas disponibles.</p>}
          </div>
        </section>
        </>
        )}
      </div>
    </main>
  );
}
