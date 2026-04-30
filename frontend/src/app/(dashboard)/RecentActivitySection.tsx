'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { FiChevronRight, FiFileText } from 'react-icons/fi';
import { STATUS_LABELS } from '@/types';
import { sectionAnimation, type DashboardData } from './dashboard.constants';

interface RecentActivitySectionProps {
  encounters: DashboardData['recent'];
  isLoading: boolean;
}

export default function RecentActivitySection({ encounters, isLoading }: RecentActivitySectionProps) {
  return (
    <section
      className="animate-fade-in overflow-hidden rounded-[14px] border border-surface-muted/45 bg-surface-elevated shadow-soft xl:col-span-2"
      style={sectionAnimation(220)}
    >
      <div className="flex flex-col gap-3 border-b border-surface-muted/35 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Actividad reciente</h2>
          <p className="mt-1 text-sm text-ink-secondary">Últimas atenciones registradas con estado y avance.</p>
        </div>
        <Link href="/atenciones" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
          Ir al historial
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-[10px] skeleton" />
          ))}
        </div>
      ) : encounters.length > 0 ? (
        <div className="divide-y divide-surface-muted/35">
          {encounters.map((encounter) => (
            <Link
              key={encounter.id}
              href={`/atenciones/${encounter.id}`}
              className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/45 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_180px_140px_32px] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/40',
                      encounter.status === 'COMPLETADO'
                        ? 'bg-status-green/18 text-status-green-text'
                        : encounter.status === 'EN_PROGRESO'
                          ? 'bg-clinical-100 text-clinical-800'
                          : 'bg-surface-muted/30 text-ink-secondary',
                    )}
                  >
                    <FiFileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{encounter.patientName}</p>
                    <p className="mt-1 truncate text-sm text-ink-secondary">
                      {encounter.patientRut || 'Sin RUT'} · {encounter.createdByName}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <p className="font-bold text-ink">{STATUS_LABELS[encounter.status]}</p>
                <p className="mt-1 text-ink-secondary">
                  {format(new Date(encounter.updatedAt), 'd MMM, HH:mm', { locale: es })}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {encounter.progress.completed}/{encounter.progress.total}
                </p>
                <p className="mt-1 text-ink-secondary">secciones</p>
              </div>
              <FiChevronRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink lg:block" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-sm text-ink-secondary">No hay atenciones recientes para mostrar.</p>
        </div>
      )}
    </section>
  );
}
