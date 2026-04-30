'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiChevronRight, FiUsers } from 'react-icons/fi';

interface RecentPatientsSectionProps {
  patients: Array<{
    patientId: string;
    patientName: string;
    patientRut: string | null;
    updatedAt: string;
    latestEncounterId: string;
    latestEncounterStatus: string;
    encounterCount: number;
  }>;
  isLoading: boolean;
}

export default function RecentPatientsSection({ patients, isLoading }: RecentPatientsSectionProps) {
  return (
    <section className="animate-fade-in overflow-hidden rounded-[14px] border border-surface-muted/45 bg-surface-elevated shadow-soft">
      <div className="flex items-center justify-between gap-4 border-b border-surface-muted/35 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Pacientes recientes</h2>
          <p className="mt-1 text-sm text-ink-secondary">Acceso directo a los últimos pacientes tocados por el equipo.</p>
        </div>
        <Link href="/pacientes" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
          Ver padrón
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-14 rounded-[10px] skeleton" />
          ))}
        </div>
      ) : patients.length > 0 ? (
        <div className="divide-y divide-surface-muted/35">
          {patients.map((patient) => (
            <Link
              key={patient.patientId}
              href={`/pacientes/${patient.patientId}`}
              className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/45 sm:px-6 lg:grid-cols-[minmax(0,1fr)_150px_20px]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/40 bg-surface-inset text-ink-secondary">
                    <FiUsers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{patient.patientName}</p>
                    <p className="mt-1 truncate text-sm text-ink-secondary">
                      {patient.patientRut || 'Sin RUT'} · {patient.encounterCount} atención{patient.encounterCount === 1 ? '' : 'es'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <p className="font-medium text-ink">{patient.latestEncounterStatus}</p>
                <p className="mt-1 text-ink-secondary">
                  {format(new Date(patient.updatedAt), 'd MMM, HH:mm', { locale: es })}
                </p>
              </div>
              <FiChevronRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink lg:block" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-sm text-ink-secondary">Todavía no hay pacientes recientes para mostrar.</p>
        </div>
      )}
    </section>
  );
}
