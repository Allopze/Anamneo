'use client';

import { FiArrowRight, FiCheckCircle, FiX } from 'react-icons/fi';
import { useOnboarding } from '@/lib/onboarding';
import { Dialog } from '@/components/common/Dialog';

interface OnboardingWelcomeModalProps {
  onClose: () => void;
}

export default function OnboardingWelcomeModal({ onClose }: OnboardingWelcomeModalProps) {
  const { progress } = useOnboarding();

  return (
    <Dialog
      isOpen={progress !== null && progress !== undefined}
      onClose={onClose}
      role="dialog"
      title="Bienvenido/a a Anamneo"
      maxWidth="md"
      className="overflow-hidden"
    >
      <div className="px-6 pb-6 pt-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
          aria-label="Cerrar"
        >
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
          <FiCheckCircle className="h-7 w-7 text-accent-text" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold text-ink">
          Bienvenido/a a Anamneo
        </h2>
        <p className="mt-2 text-sm leading-5 text-ink-secondary">
          Preparamos una guía de {progress?.steps.length ?? 0} pasos para ayudarte a comenzar.
          Puedes completarlos a tu ritmo — no bloquean tu trabajo clínico.
        </p>

        <div className="mt-5 space-y-2">
          {progress?.steps.slice(0, 3).map((step, index) => (
            <div
              key={step.id}
              className="flex items-center gap-3 rounded-xl border border-surface-muted/40 bg-surface-base/50 px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-bold text-accent-text">
                {index + 1}
              </span>
              <p className="text-sm font-medium text-ink">{step.title}</p>
            </div>
          ))}
          {(progress?.steps.length ?? 0) > 3 && (
            <p className="px-1 text-xs text-ink-muted">
              y {(progress?.steps.length ?? 0) - 3} pasos más…
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-frame-dark px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-ink"
          >
            Ver guía de inicio
            <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Explorar solo
          </button>
        </div>
      </div>
    </Dialog>
  );
}
