'use client';

import type { UseFormRegisterReturn, FieldError } from 'react-hook-form';
import { FiCheck, FiEye, FiEyeOff, FiMail } from 'react-icons/fi';
import { ShieldIcon, LockIcon } from '@/components/icons';

interface Login2FAStepProps {
  verificationMethod: 'totp' | 'recovery';
  isLoading: boolean;
  verificationCodeField: UseFormRegisterReturn;
  verificationCodeError: FieldError | undefined;
  onMethodChange: (method: 'totp' | 'recovery') => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function Login2FAStep({
  verificationMethod,
  isLoading,
  verificationCodeField,
  verificationCodeError,
  onMethodChange,
  onSubmit,
  onBack,
}: Login2FAStepProps) {
  return (
    <form method="post" noValidate onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onMethodChange('totp')}
          className={`btn ${verificationMethod === 'totp' ? 'btn-accent' : 'btn-secondary'}`}
        >
          App autenticadora
        </button>
        <button
          type="button"
          onClick={() => onMethodChange('recovery')}
          className={`btn ${verificationMethod === 'recovery' ? 'btn-accent' : 'btn-secondary'}`}
        >
          Código de recuperación
        </button>
      </div>

      <div>
        <label htmlFor="totp-code" className="form-label">
          {verificationMethod === 'totp' ? 'Código de verificación' : 'Código de recuperación'}
        </label>
        <div className="relative">
          <ShieldIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
          <input
            id="totp-code"
            type="text"
            inputMode={verificationMethod === 'totp' ? 'numeric' : 'text'}
            autoComplete={verificationMethod === 'totp' ? 'one-time-code' : 'off'}
            autoCapitalize={verificationMethod === 'totp' ? undefined : 'characters'}
            spellCheck={verificationMethod === 'totp' ? undefined : false}
            maxLength={verificationMethod === 'totp' ? 6 : 19}
            className={`form-input pl-10 ${verificationMethod === 'totp' ? 'text-center text-xl tracking-[0.3em]' : 'font-mono uppercase tracking-[0.18em]'} ${verificationCodeError ? 'form-input-error' : ''}`}
            placeholder={verificationMethod === 'totp' ? '000000…' : 'ABCD-EFGH…'}
            aria-invalid={!!verificationCodeError}
            aria-describedby={verificationCodeError ? 'totp-error' : undefined}
            {...verificationCodeField}
            onChange={(event) => {
              event.target.value =
                verificationMethod === 'totp'
                  ? event.target.value.replace(/\D/g, '').slice(0, 6)
                  : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 19);
              verificationCodeField.onChange(event);
            }}
          />
        </div>
        {verificationMethod === 'recovery' ? (
          <p className="mt-2 text-xs text-ink-muted">
            Usa uno de los códigos que guardaste al activar 2FA. Cada código se consume después de usarlo.
          </p>
        ) : null}
        {verificationCodeError ? (
          <p id="totp-error" className="form-error" role="alert">
            {verificationCodeError.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        aria-label="Verificar código"
        className="btn btn-accent w-full py-3"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2" aria-live="polite">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Verificando…
          </span>
        ) : (
          'Verificar e iniciar sesión'
        )}
      </button>

      <button type="button" onClick={onBack} className="auth-secondary-action">
        Volver al inicio de sesión
      </button>
    </form>
  );
}

interface LoginCredentialsStepProps {
  isLoading: boolean;
  emailField: UseFormRegisterReturn;
  passwordField: UseFormRegisterReturn;
  emailError: FieldError | undefined;
  passwordError: FieldError | undefined;
  showPassword: boolean;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginCredentialsStep({
  isLoading,
  emailField,
  passwordField,
  emailError,
  passwordError,
  showPassword,
  onTogglePassword,
  onSubmit,
}: LoginCredentialsStepProps) {
  return (
    <form method="post" noValidate onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="form-label">
          Correo electrónico
        </label>
        <div className="relative">
          <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isLoading}
            className={`form-input pl-10 ${emailError ? 'form-input-error' : ''}`}
            placeholder="nombre@clinica.cl"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
            {...emailField}
          />
        </div>
        {emailError ? (
          <p id="email-error" className="form-error" role="alert">
            {emailError.message}
          </p>
        ) : null}
      </div>

      <div>
        <div className="auth-field-row">
          <label htmlFor="password" className="form-label">
            Contraseña
          </label>
        </div>
        <div className="relative">
          <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={isLoading}
            className={`form-input pl-10 pr-12 ${passwordError ? 'form-input-error' : ''}`}
            placeholder="Tu contraseña"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'password-error' : undefined}
            {...passwordField}
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="auth-password-toggle"
            aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
          >
            {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
          </button>
        </div>
        {passwordError ? (
          <p id="password-error" className="form-error" role="alert">
            {passwordError.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        aria-label="Iniciar sesión"
        className="btn btn-accent w-full py-3"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2" aria-live="polite">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Iniciando sesión…
          </span>
        ) : (
          'Iniciar sesión'
        )}
      </button>
    </form>
  );
}

export { FiCheck };
