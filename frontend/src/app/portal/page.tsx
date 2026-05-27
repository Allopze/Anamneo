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
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {isLoading && (
          <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true" aria-label="Cargando tu información">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
              <p className="text-sm text-slate-500">Cargando tu información…</p>
            </div>
          </div>
        )}
        {!isLoading && (
        <>
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Portal paciente</h1>
            <p className="text-sm text-slate-600">{patient ? patient.nombre : '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/solicitudes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              Solicitudes
            </Link>
            <Link href="/portal/historial-acceso" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              Historial de accesos
            </Link>
            <button onClick={handleLogout} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
              Salir
            </button>
          </div>
        </header>

        {error && <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{getErrorMessage(error)}</div>}

        {patient && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Datos generales</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-slate-500">RUT</dt><dd>{patient.rut ?? 'Sin RUT'}</dd></div>
              <div><dt className="text-slate-500">Nacimiento</dt><dd>{patient.fechaNacimiento ? new Date(patient.fechaNacimiento).toLocaleDateString('es-CL') : '—'}</dd></div>
              <div><dt className="text-slate-500">Sexo</dt><dd>{patient.sexo ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Previsión</dt><dd>{patient.prevision ?? '—'}</dd></div>
            </dl>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Atenciones finalizadas</h2>
            <FiFileText className="h-5 w-5 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {encounters.map((encounter) => (
              <Link key={encounter.id} href={`/portal/atenciones/${encounter.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{encounter.motivoConsulta || encounter.tipoAtencion || 'Atención clínica'}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(encounter.fecha).toLocaleDateString('es-CL')} · {encounter.medico?.nombre ?? 'Equipo clínico'} · {encounter.status}
                  </p>
                </div>
                <FiDownload className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
            {encounters.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No hay atenciones finalizadas disponibles.</p>}
          </div>
        </section>
        </>
        )}
      </div>
    </main>
  );
}
