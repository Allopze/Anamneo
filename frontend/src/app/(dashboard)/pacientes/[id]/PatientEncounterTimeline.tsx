import Link from 'next/link';
import clsx from 'clsx';
import {
  FiCalendar,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiEye,
  FiFileText,
  FiPlus,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Encounter, PaginatedResponse } from '@/types';
import { REVIEW_STATUS_LABELS, STATUS_LABELS } from '@/types';
import { buildEncounterSummary } from '@/lib/clinical';
import type { PatientDetailHook } from './usePatientDetail';

type Props = Pick<
  PatientDetailHook,
  | 'encounterPage'
  | 'setEncounterPage'
  | 'isTimelineLoading'
  | 'isTimelinePlaceholderData'
  | 'canCreateEncounterAllowed'
  | 'createEncounterMutation'
> & {
  encounterTimeline: PaginatedResponse<Encounter> | undefined;
};

export default function PatientEncounterTimeline({
  encounterTimeline,
  encounterPage,
  setEncounterPage,
  isTimelineLoading,
  isTimelinePlaceholderData,
  canCreateEncounterAllowed,
  createEncounterMutation,
}: Props) {
  const timelineEncounters = encounterTimeline?.data || [];
  const encounterPagination = encounterTimeline?.pagination;

  return (
    <div className="lg:col-span-2">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Atenciones</h2>
          <span className="text-sm text-ink-muted">{encounterPagination?.total || 0} atenciones registradas</span>
        </div>

        {timelineEncounters.length > 0 ? (
          <div className={clsx('relative transition-opacity duration-200', isTimelinePlaceholderData && 'opacity-50')}>
            <div className="absolute left-5 top-0 bottom-0 w-px bg-surface-muted" />

            <div className="space-y-4">
              {timelineEncounters.map((encounter: Encounter) => {
                const isCompleted = encounter.status === 'COMPLETADO';
                const isInProgress = encounter.status === 'EN_PROGRESO';
                const actionLabel = isInProgress ? 'Continuar' : 'Ver atención';

                return (
                  <div key={encounter.id} className="relative pl-10">
                    <div
                      className={clsx(
                        'absolute left-1.5 top-4 w-7 h-7 rounded-full flex items-center justify-center border',
                        isCompleted
                          ? 'bg-status-green/20 text-status-green border-status-green/30'
                          : isInProgress
                          ? 'bg-status-yellow/40 text-accent-text border-status-yellow/70'
                          : 'bg-surface-muted text-ink-secondary border-surface-muted/30',
                      )}
                    >
                      <FiFileText className="w-4 h-4" />
                    </div>

                    <div className="rounded-card border border-surface-muted/30 bg-surface-elevated p-4 hover:bg-surface-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/atenciones/${encounter.id}`}
                              className="font-medium text-ink-primary hover:text-accent-text"
                            >
                              Atención del {format(new Date(encounter.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                            </Link>
                            <span
                              className={clsx(
                                'text-xs px-2 py-0.5 rounded-full',
                                isCompleted
                                  ? 'bg-status-green/20 text-status-green'
                                  : isInProgress
                                  ? 'border border-status-yellow/70 bg-status-yellow/40 text-accent-text'
                                  : 'bg-surface-muted text-ink-secondary',
                              )}
                            >
                              {STATUS_LABELS[encounter.status]}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-4 text-sm text-ink-muted flex-wrap">
                            <span className="flex items-center gap-1">
                              <FiClock className="w-3 h-3" />
                              {format(new Date(encounter.createdAt), 'HH:mm')}
                            </span>
                            <span>Por {encounter.createdBy?.nombre || '—'}</span>
                            {encounter.reviewStatus && <span>{REVIEW_STATUS_LABELS[encounter.reviewStatus]}</span>}
                            {encounter.progress && (
                              <span>
                                {encounter.progress.completed}/{encounter.progress.total} secciones
                              </span>
                            )}
                          </div>

                          {buildEncounterSummary(encounter).length > 0 && (
                            <div className="mt-3 space-y-1 rounded-card bg-surface-base/40 p-3 text-sm text-ink-secondary">
                              {buildEncounterSummary(encounter).map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link href={`/atenciones/${encounter.id}`} className="btn btn-secondary">
                            {actionLabel}
                            <FiChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </div>
                      </div>

                      {encounter.tasks && encounter.tasks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {encounter.tasks.slice(0, 3).map((task) => (
                            <span
                              key={task.id}
                              className="rounded-full border border-status-yellow/60 bg-status-yellow/30 px-2 py-1 text-accent-text"
                            >
                              <FiClipboard className="mr-1 inline-block h-3 w-3" />
                              {task.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {isCompleted && (
                        <div className="mt-3 border-t border-surface-muted/20 pt-3">
                          <Link
                            href={`/atenciones/${encounter.id}/ficha`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:text-ink"
                          >
                            <FiEye className="w-4 h-4" />
                            Ver ficha clínica
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {encounterPagination && encounterPagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-surface-muted/20 pt-4">
                <span className="text-sm text-ink-muted">
                  Página {encounterPagination.page} de {encounterPagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-secondary"
                    disabled={encounterPage <= 1}
                    onClick={() => setEncounterPage((current: number) => Math.max(current - 1, 1))}
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={isTimelinePlaceholderData || encounterPage >= encounterPagination.totalPages}
                    onClick={() => setEncounterPage((current: number) => current + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : isTimelineLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-24 skeleton rounded-card" />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCalendar className="w-8 h-8 text-ink-muted" />
            </div>
            <h3 className="font-medium text-ink-primary mb-1">Sin atenciones</h3>
            <p className="text-ink-muted mb-4">No hay atenciones registradas para este paciente</p>
            {canCreateEncounterAllowed && (
              <button onClick={() => createEncounterMutation.mutate()} className="btn btn-primary">
                <FiPlus className="w-4 h-4 mr-2" />
                Crear primera atención
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
