'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import { sanitizeRedirectPath } from '@/lib/login-redirect';
import { useAuthStore } from '@/stores/auth-store';
import { stashAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { FiArrowRight, FiCheck, FiClipboard, FiFileText, FiLock, FiMail, FiShield, FiUsers } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { AuthFrame } from '@/components/auth/AuthFrame';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

const totpSchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos').regex(/^\d{6}$/, 'Solo dígitos'),
});

type TotpForm = z.infer<typeof totpSchema>;

const LOGIN_CHIPS = [
  { icon: <FiClipboard className="h-3.5 w-3.5" />, label: 'Flujo clínico' },
  { icon: <FiFileText className="h-3.5 w-3.5" />, label: 'Revisión' },
  { icon: <FiShield className="h-3.5 w-3.5" />, label: 'Trazabilidad' },
  { icon: <FiUsers className="h-3.5 w-3.5" />, label: 'Roles' },
];

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-shell">
          <div className="status-card max-w-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="mt-4 text-sm text-ink-muted">Cargando acceso...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerTotp,
    handleSubmit: handleTotp,
    formState: { errors: totpErrors },
  } = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const loginResponse = await api.post('/auth/login', data);

      if (loginResponse.data?.requires2FA) {
        setTempToken(loginResponse.data.tempToken);
        setStep('2fa');
        setIsLoading(false);
        return;
      }

      const sessionUser = loginResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);

      toast.success('¡Bienvenido!');
      router.push(sanitizeRedirectPath(searchParams.get('from'), '/'));
    } catch (err) {
      const apiMessage = getErrorMessage(err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(
          apiMessage && apiMessage !== 'Unauthorized'
            ? apiMessage
            : 'Credenciales incorrectas. Verifica tu correo y contraseña.',
        );
      } else {
        setError(apiMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onVerify2FA = async (data: TotpForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const verifyResponse = await api.post('/auth/2fa/verify', { tempToken, code: data.code });

      const sessionUser = verifyResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);

      toast.success('¡Bienvenido!');
      router.push(sanitizeRedirectPath(searchParams.get('from'), '/'));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Código incorrecto o expirado. Intenta de nuevo.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Espacio Clínico"
      title="Contexto clínico desde el primer acceso."
      chips={LOGIN_CHIPS}
      cardEyebrow="Acceso"
      cardTitle={step === '2fa' ? 'Verificación 2FA' : 'Iniciar sesión'}
      cardDescription={step === '2fa' ? 'Ingresa el código de tu app autenticadora.' : undefined}
      footer={
        <p className="text-center text-ink-secondary">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="auth-inline-link">
            Crear cuenta <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      }
    >
      {step === '2fa' && (
        <>
          <div className="auth-step-bar">
            <span className="auth-step auth-step-done"><FiCheck className="h-3.5 w-3.5" /> Credenciales</span>
            <span className="auth-step auth-step-active"><FiShield className="h-3.5 w-3.5" /> Verificación</span>
          </div>
          <div className="auth-note">
            <span className="auth-badge-accent"><FiShield className="h-3.5 w-3.5" /> 2FA activo</span>
            <span className="auth-badge"><FiLock className="h-3.5 w-3.5" /> Código de 6 dígitos</span>
          </div>
        </>
      )}

      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {step === '2fa' ? (
        <form onSubmit={handleTotp(onVerify2FA)} className="space-y-5">
          <div>
            <label htmlFor="totp-code" className="form-label">
              Código de verificación
            </label>
            <div className="relative">
              <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={`form-input pl-10 text-center text-xl tracking-[0.3em] ${totpErrors.code ? 'form-input-error' : ''}`}
                placeholder="000000"
                aria-invalid={!!totpErrors.code}
                aria-describedby={totpErrors.code ? 'totp-error' : undefined}
                autoFocus
                {...registerTotp('code')}
              />
            </div>
            {totpErrors.code ? (
              <p id="totp-error" className="form-error" role="alert">
                {totpErrors.code.message}
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
              'Verificar y Entrar'
            )}
          </button>

          <button
            type="button"
            onClick={() => { setStep('credentials'); setError(null); setTempToken(null); }}
            className="w-full text-center text-sm text-ink-secondary hover:text-ink"
          >
            Volver al inicio de sesión
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              className={`form-input pl-10 ${errors.email ? 'form-input-error' : ''}`}
              placeholder="nombre@clinica.cl"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
          </div>
          {errors.email ? (
            <p id="email-error" className="form-error" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="password" className="form-label mb-0">
              Contraseña
            </label>
            <span className="text-micro text-ink-muted">Usa la clave asignada a tu cuenta</span>
          </div>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={`form-input pl-10 ${errors.password ? 'form-input-error' : ''}`}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
          </div>
          {errors.password ? (
            <p id="password-error" className="form-error" role="alert">
              {errors.password.message}
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
            <span className="flex items-center gap-2" aria-live="polite">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Iniciando sesión…
            </span>
          ) : (
            'Entrar a Anamneo'
          )}
        </button>
      </form>
      )}
    </AuthFrame>
  );
}
