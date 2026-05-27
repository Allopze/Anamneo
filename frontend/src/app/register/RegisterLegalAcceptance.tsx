import Link from 'next/link';
import type { FieldError, UseFormRegister } from 'react-hook-form';
import type { RegisterForm } from './register.constants';

interface RegisterLegalAcceptanceProps {
  register: UseFormRegister<RegisterForm>;
  error?: FieldError;
  disabled: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
}

export default function RegisterLegalAcceptance({
  register,
  error,
  disabled,
  termsVersion,
  privacyVersion,
}: RegisterLegalAcceptanceProps) {
  const versionLabel = termsVersion && privacyVersion
    ? `Términos v${termsVersion} · Privacidad v${privacyVersion}`
    : 'Cargando versiones legales vigentes.';

  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2.5 text-sm leading-6 text-ink-secondary">
        <input
          type="checkbox"
          className="legal-checkbox mt-[3px]"
          {...register('acceptedLegal')}
          disabled={disabled}
          aria-describedby={error ? 'accepted-legal-error' : 'accepted-legal-help'}
        />
        <span>
          Acepto los{' '}
          <Link
            href="/terminos-y-condiciones"
            className="font-semibold text-ink underline decoration-ink/25 underline-offset-2 transition-colors hover:text-frame hover:decoration-frame"
            target="_blank"
            rel="noreferrer"
          >
            Términos y Condiciones
          </Link>{' '}
          y la{' '}
          <Link
            href="/politica-de-privacidad"
            className="font-semibold text-ink underline decoration-ink/25 underline-offset-2 transition-colors hover:text-frame hover:decoration-frame"
            target="_blank"
            rel="noreferrer"
          >
            Política de Privacidad
          </Link>{' '}
          vigentes de Anamneo.
        </span>
      </label>
      <p id="accepted-legal-help" className="pl-[1.75rem] text-micro text-ink-muted">
        {versionLabel}
      </p>
      {error ? (
        <p id="accepted-legal-error" className="pl-[1.75rem] form-error" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
