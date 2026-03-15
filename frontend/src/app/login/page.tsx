'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiMail, FiLock } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
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
      router.push('/pacientes');
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
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 items-center justify-center">
        <div className="max-w-md text-white">
          <AnamneoLogo
            className="mb-8"
            iconClassName="h-12 w-12"
            textClassName="text-3xl font-bold text-white"
            priority
          />
          <p className="text-xl text-primary-100 mb-6">
            Sistema integral para la gestión de fichas clínicas y atención de pacientes.
          </p>
          <ul className="space-y-3 text-primary-100">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-300 rounded-full" />
              Registro completo de atenciones médicas
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-300 rounded-full" />
              Historial clínico por paciente
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-300 rounded-full" />
              Sugerencias automáticas de afecciones
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-300 rounded-full" />
              Exportación a PDF
            </li>
          </ul>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <AnamneoLogo
            className="justify-center mb-8 lg:hidden"
            iconClassName="h-10 w-10"
            textClassName="text-2xl font-bold text-slate-900"
            priority
          />

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-slate-600 mt-2">Ingresa tus credenciales para acceder</p>
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
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`form-input pl-10 ${errors.email ? 'form-input-error' : ''}`}
                  placeholder="tu@email.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </div>
              {errors.email && <p id="email-error" className="form-error" role="alert">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
              {errors.password && <p id="password-error" className="form-error" role="alert">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <p className="text-center text-slate-600 mt-6">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
