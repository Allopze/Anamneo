'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiArrowRight, FiFileText, FiLock, FiMail, FiShield, FiUsers } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { AuthFrame } from '@/components/auth/AuthFrame';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

const LOGIN_FEATURES = [
  {
    label: 'Consulta',
    title: 'Atenciones ordenadas por contexto',
    description: 'Avanza entre registro, revisión y cierre sin perder el hilo clínico del paciente.',
  },
  {
    label: 'Seguimiento',
    title: 'Historial longitudinal claro',
    description: 'Pacientes, controles y pendientes viven en el mismo flujo de trabajo.',
  },
  {
    label: 'Seguridad',
    title: 'Acceso pensado para equipos',
    description: 'Permisos, trazabilidad y sesiones seguras para roles clínicos y operativos.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // Login sets HttpOnly cookies automatically
      await api.post('/auth/login', data);

      // Fetch user profile using the cookie-based session
      const userResponse = await api.get('/auth/me');

      login({
        id: userResponse.data.id,
        email: userResponse.data.email,
        nombre: userResponse.data.nombre,
        role: userResponse.data.role as 'MEDICO' | 'ASISTENTE' | 'ADMIN',
        isAdmin: !!userResponse.data.isAdmin,
        medicoId: userResponse.data.medicoId ?? null,
      });

      toast.success('¡Bienvenido!');
      const redirectTo = searchParams.get('from') || '/pacientes';
      router.push(redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/pacientes');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
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
      title="Recupera el contexto de cada atención desde el primer clic."
      description="Anamneo organiza pacientes, evolución clínica y revisión médica en una misma superficie de trabajo."
      features={LOGIN_FEATURES}
      cardEyebrow="Acceso"
      cardTitle="Iniciar sesión"
      cardDescription="Ingresa con tus credenciales para volver a tu panel clínico."
      heroFootnote="Anamneo mantiene trazabilidad y contexto clínico sin recargar la interfaz."
      footer={
        <p className="text-center text-ink-secondary">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="auth-inline-link">
            Crear cuenta <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      }
    >
      <div className="auth-note">
        <div className="auth-note-icon">
          <FiShield className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="auth-note-title">Ingreso seguro</p>
          <p className="auth-note-copy">
            La sesión se valida contra el backend y se restaura el perfil antes de abrir la app.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

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

        <div className="auth-inline-metrics" aria-hidden="true">
          <div className="auth-inline-metric">
            <FiUsers className="h-4 w-4" />
            <span>Trabajo por roles</span>
          </div>
          <div className="auth-inline-metric">
            <FiFileText className="h-4 w-4" />
            <span>Registro longitudinal</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-label="Iniciar sesión"
          className="btn btn-primary w-full py-3"
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
    </AuthFrame>
  );
}
