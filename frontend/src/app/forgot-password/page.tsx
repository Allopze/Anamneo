'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft, FiMail } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { LockIcon, ShieldIcon } from '@/components/icons';

const schema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
});

type FormValues = z.infer<typeof schema>;

const RECOVERY_CHIPS = [
  {
    icon: <ShieldIcon className="h-7 w-7" aria-hidden="true" />,
    label: 'Trazabilidad clínica',
    description: 'Cada solicitud queda registrada para auditoría.',
  },
];

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', data);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame
      variant="loginCompact"
      eyebrow="Acceso clínico"
      title="Recupera el acceso a tu espacio clínico."
      description="Te enviaremos un enlace de un solo uso al correo asociado a tu cuenta."
      chips={RECOVERY_CHIPS}
      cardEyebrow="Recuperación"
      cardTitle="Recuperar contraseña"
      cardDescription="Ingresa tu correo y enviaremos un enlace para restablecerla. El enlace caduca rápido y solo puede usarse una vez."
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
        <Link href="/login" className="auth-inline-link justify-center">
          <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a inicio de sesión
        </Link>
      }
    >
      <div className="space-y-6">
        {submitted ? (
          <div
            className="rounded-md border border-status-green/30 bg-status-green/10 px-4 py-3 text-sm text-ink-primary"
            role="status"
            aria-live="polite"
          >
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            Revisa también la carpeta de spam.
          </div>
        ) : (
          <>
            {error && <ErrorAlert message={error} />}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                    className={`form-input pl-10 ${errors.email ? 'form-input-error' : ''}`}
                    placeholder="tu@correo.cl"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="form-error">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
                {isLoading ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
