'use client';

import Link from 'next/link';
import { FiAlertTriangle, FiChevronRight, FiX } from 'react-icons/fi';
import { PatientTask } from '@/types';
import { sectionAnimation } from './dashboard.constants';

interface OverdueAlertSectionProps {
  overdueCount: number;
  overdueTasks: PatientTask[];
  onDismiss: () => void;
}

export default function OverdueAlertSection({ overdueCount, overdueTasks, onDismiss }: OverdueAlertSectionProps) {
  return (
    <section
      className="animate-fade-in overflow-hidden rounded-card border border-status-red/30 bg-status-red/8 shadow-soft"
      style={sectionAnimation(40)}
      role="alert"
    >
      <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-red/20 text-status-red">
          <FiAlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">
            {overdueCount === 1 ? 'Tienes 1 tarea atrasada' : `Tienes ${overdueCount} tareas atrasadas`}
          </h2>
          <div className="mt-2 space-y-1">
            {overdueTasks.slice(0, 4).map((task) => (
              <Link
                key={task.id}
                href={`/pacientes/${task.patient?.id ?? task.patientId}`}
                className="flex items-center gap-2 text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-red" />
                <span className="truncate font-medium">{task.title}</span>
                <span className="shrink-0 text-ink-muted">· {task.patient?.nombre ?? 'Paciente'}</span>
              </Link>
            ))}
            {overdueCount > 4 && <p className="text-sm text-ink-muted">y {overdueCount - 4} más…</p>}
          </div>
          <Link
            href="/seguimientos?overdueOnly=true"
            className="mt-3 inline-flex text-sm font-bold text-status-red-text transition-colors hover:text-status-red"
          >
            Ver todas las tareas atrasadas
            <FiChevronRight className="ml-1 mt-0.5 h-3.5 w-3.5" />
          </Link>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
          aria-label="Descartar alerta"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
