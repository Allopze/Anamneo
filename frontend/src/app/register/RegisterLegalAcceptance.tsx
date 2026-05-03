import Link from 'next/link';
import type { FieldError, UseFormRegister } from 'react-hook-form';
import { LEGAL_DOCUMENT_VERSION } from '../../../../shared/legal-contract';
import type { RegisterForm } from './register.constants';

interface RegisterLegalAcceptanceProps {
  register: UseFormRegister<RegisterForm>;
  error?: FieldError;
  disabled: boolean;
}

export default function RegisterLegalAcceptance({
  register,
  error,
  disabled,
}: RegisterLegalAcceptanceProps) {
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
          Versión legal {LEGAL_DOCUMENT_VERSION}.
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
