'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import { sanitizeRedirectPath } from '@/lib/login-redirect';
import { useAuthLogin } from '@/stores/auth-store';
import { stashAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import { ShieldIcon, LockIcon } from '@/components/icons';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { feedbackCopy, notify } from '@/lib/notify';
import { LoginFallback } from './LoginFallback';
import { Login2FAStep, LoginCredentialsStep } from './login.parts';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

const verificationSchema = z.object({
  code: z.string().trim().min(6, 'Ingresa un código válido').max(32, 'Ingresa un código válido'),
});

type VerificationForm = z.infer<typeof verificationSchema>;
type VerificationMethod = 'totp' | 'recovery';
type RegistrationMode = 'loading' | 'bootstrap-open' | 'invitation-only';

const LOGIN_CHIPS = [
  {
    icon: <ShieldIcon className="h-7 w-7" aria-hidden="true" />,
    label: 'Trazabilidad clínica',
    description: 'Cada acceso queda registrado para auditoría.',
  },
];

export function LoginClient() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthLogin();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('totp');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const {
    register: registerVerification,
    handleSubmit: handleVerification,
    reset: resetVerification,
    formState: { errors: verificationErrors },
  } = useForm<VerificationForm>({ resolver: zodResolver(verificationSchema) });

  const bootstrapQuery = useQuery({
    queryKey: ['auth', 'bootstrap'],
    queryFn: () => api.get('/auth/bootstrap').then((r) => r.data as { hasAdmin: boolean }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const registrationMode: RegistrationMode = bootstrapQuery.isLoading
    ? 'loading'
    : bootstrapQuery.data?.hasAdmin
      ? 'invitation-only'
      : 'bootstrap-open';

  const registrationFooter =
    registrationMode === 'invitation-only' ? (
      <p className="text-center text-ink-secondary">
        El acceso requiere una invitación válida del administrador del espacio clínico.
      </p>
    ) : registrationMode === 'loading' ? (
      <p className="text-center text-ink-muted">Verificando opciones de acceso…</p>
    ) : (
      <p className="text-center text-ink-secondary">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="auth-inline-link">
          Crear cuenta <FiArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </p>
    );

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const loginResponse = await api.post('/auth/login', data);
      if (loginResponse.data?.requires2FA) {
        setTempToken(loginResponse.data.tempToken);
        setVerificationMethod('totp');
        resetVerification({ code: '' });
        setStep('2fa');
        setIsLoading(false);
        return;
      }
      const sessionUser = loginResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);
      notify.success(feedbackCopy.sessionStarted);
      router.push(sanitizeRedirectPath(searchParams.get('from'), '/'));
    } catch (err) {
      const apiMessage = getErrorMessage(err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(
          apiMessage && apiMessage !== 'Unauthorized'
            ? apiMessage
            : 'No pudimos iniciar sesión. Revisa tus credenciales o recupera tu contraseña.',
        );
      } else {
        setError(apiMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onVerify2FA = async (data: VerificationForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const verifyResponse = await api.post('/auth/2fa/verify', { tempToken, code: data.code });
      const sessionUser = verifyResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);
      notify.success(feedbackCopy.sessionStarted);
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

  const handleMethodChange = (method: VerificationMethod) => {
    setVerificationMethod(method);
    resetVerification({ code: '' });
    setError(null);
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setVerificationMethod('totp');
    resetVerification({ code: '' });
    setError(null);
    setTempToken(null);
  };

  return (
    <AuthFrame
      variant="loginCompact"
      eyebrow="Acceso clínico"
      title="Acceso seguro a tu espacio clínico."
      description="Consulta y gestiona información clínica con trazabilidad y permisos activos."
      chips={LOGIN_CHIPS}
      cardEyebrow="Acceso"
      cardTitle={step === '2fa' ? 'Verificación 2FA' : 'Iniciar sesión'}
      cardDescription={
        step === '2fa'
          ? verificationMethod === 'totp'
            ? 'Ingresa el código de tu app autenticadora.'
            : 'Ingresa uno de tus códigos de recuperación de un solo uso.'
          : 'Accede con tu cuenta clínica.'
      }
      className={step === '2fa' ? 'auth-card-2fa' : undefined}
      logoIconClassName="!h-14 !w-14 lg:!h-20 lg:!w-20"
      logoTextClassName="!text-3xl lg:!text-4xl"
      heroFooter={
        <div className="auth-help">
          <LockIcon className="h-7 w-7" aria-hidden="true" />
          <span>
            <span className="auth-help-title">Cifrado de extremo a extremo</span>
            <span className="auth-help-copy">Tus datos viajan y se almacenan cifrados.</span>
          </span>
        </div>
      }
      footer={
        <div className="space-y-3">
          {registrationFooter}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
            <Link href="/terminos-y-condiciones" className="auth-inline-link">
              Términos
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/politica-de-privacidad" className="auth-inline-link">
              Privacidad
            </Link>
          </div>
        </div>
      }
    >
      {step === '2fa' && (
        <>
          <div className="auth-step-bar">
            <span className="auth-step auth-step-done">
              <FiCheck className="h-3.5 w-3.5" aria-hidden="true" /> Credenciales
            </span>
            <span className="auth-step auth-step-active">
              <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" /> Verificación
            </span>
          </div>
          <div className="auth-note">
            <span className="auth-badge-accent">
              <ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" /> 2FA activo
            </span>
            <span className="auth-badge">
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {verificationMethod === 'totp' ? ' Código de 6 dígitos' : ' Código de recuperación'}
            </span>
          </div>
        </>
      )}

      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {step === '2fa' ? (
        <Login2FAStep
          verificationMethod={verificationMethod}
          isLoading={isLoading}
          verificationCodeField={registerVerification('code')}
          verificationCodeError={verificationErrors.code}
          onMethodChange={handleMethodChange}
          onSubmit={handleVerification(onVerify2FA)}
          onBack={handleBackToCredentials}
        />
      ) : (
        <>
          <LoginCredentialsStep
            isLoading={isLoading}
            emailField={register('email')}
            passwordField={register('password')}
            emailError={errors.email}
            passwordError={errors.password}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            onSubmit={handleSubmit(onSubmit)}
          />
          <Link href="/forgot-password" className="auth-forgot-password auth-inline-link">
            Recuperar contraseña
          </Link>
        </>
      )}
    </AuthFrame>
  );
}
