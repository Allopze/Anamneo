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
    ? `Términos ${termsVersion} · Privacidad ${privacyVersion}`
    : 'Cargando versiones legales vigentes.';

  return (
    <label className="flex items-start gap-3 rounded-card border border-surface-muted/40 bg-surface-base/45 p-4 text-sm text-ink-secondary">
      <input
        type="checkbox"
        className="mt-1"
        {...register('acceptedLegal')}
        disabled={disabled}
        aria-describedby={error ? 'accepted-legal-error' : 'accepted-legal-help'}
      />
      <span>
        Acepto los{' '}
        <Link href="/terminos-y-condiciones" className="auth-inline-link" target="_blank" rel="noreferrer">
          Términos y Condiciones
        </Link>{' '}
        y la{' '}
        <Link href="/politica-de-privacidad" className="auth-inline-link" target="_blank" rel="noreferrer">
          Política de Privacidad
        </Link>{' '}
        vigentes de Anamneo.
        <span id="accepted-legal-help" className="mt-1 block text-micro text-ink-muted">
          {versionLabel}
        </span>
        {error ? (
          <span id="accepted-legal-error" className="form-error block" role="alert">
            {error.message}
          </span>
        ) : null}
      </span>
    </label>
  );
}
