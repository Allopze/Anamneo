'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { FiCheck, FiCheckCircle, FiCircle, FiX } from 'react-icons/fi';
import { useOnboarding } from '@/lib/onboarding';

export default function OnboardingPanel() {
  const {
    eligible,
    progress,
    isLoading,
    updateProgressAsync,
    isUpdating,
  } = useOnboarding();

  if (!eligible || isLoading || !progress || !progress.eligible || progress.dismissedAt || progress.isComplete) {
    return null;
  }

  const currentProgress = progress;
  const completedStepIds = new Set(currentProgress.completedStepIds);
  const completedCount = currentProgress.steps.filter((step) => completedStepIds.has(step.id)).length;
  const progressPct = currentProgress.steps.length > 0 ? (completedCount / currentProgress.steps.length) * 100 : 0;

  async function toggleStep(stepId: string) {
    const nextStepIds = completedStepIds.has(stepId)
      ? currentProgress.completedStepIds.filter((candidate) => candidate !== stepId)
      : [...currentProgress.completedStepIds, stepId];

    await updateProgressAsync({ completedStepIds: nextStepIds });
  }

  async function dismissPanel() {
    await updateProgressAsync({ dismissed: true });
  }

  async function completeAll() {
    await updateProgressAsync({ completed: true });
  }

  return (
    <section
      className="overflow-hidden rounded-card border border-accent/25 bg-surface-elevated shadow-soft"
      aria-labelledby="onboarding-title"
    >
      <div className="flex flex-col gap-4 border-b border-surface-muted/35 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/12 text-accent-text">
              <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="onboarding-title" className="text-lg font-bold tracking-tight text-ink">
                Guía inicial
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Completa estos pasos a tu ritmo. La guía no bloquea tu trabajo clínico.
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-ink-muted">
            {completedCount} de {currentProgress.steps.length} pasos listos
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={completeAll}
            disabled={isUpdating}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-pill border border-frame-dark bg-frame-dark px-3.5 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiCheck className="h-4 w-4" aria-hidden="true" />
            Marcar todo listo
          </button>
          <button
            type="button"
            onClick={dismissPanel}
            disabled={isUpdating}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-surface-muted/50 bg-surface-elevated text-ink-secondary transition-colors hover:border-frame/25 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ocultar guía inicial"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-surface-muted/30">
        {currentProgress.steps.map((step) => {
          const isDone = completedStepIds.has(step.id);
          return (
            <div key={step.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => void toggleStep(step.id)}
                  disabled={isUpdating}
                  className={clsx(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    isDone
                      ? 'border-status-green/40 bg-status-green/15 text-status-green'
                      : 'border-surface-muted/50 bg-surface-inset text-ink-muted hover:border-frame/25 hover:text-ink',
                  )}
                  aria-label={isDone ? `Marcar pendiente: ${step.title}` : `Marcar listo: ${step.title}`}
                >
                  {isDone ? <FiCheck className="h-4 w-4" /> : <FiCircle className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-ink-secondary">{step.description}</p>
                </div>
              </div>
              <Link
                href={step.href}
                className="inline-flex h-9 items-center justify-center rounded-pill border border-surface-muted/60 bg-surface-elevated px-3.5 text-sm font-semibold text-ink-secondary transition-colors hover:border-frame/25 hover:text-ink sm:justify-self-end"
              >
                {step.actionLabel}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
