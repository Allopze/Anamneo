'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';

const REGISTER_DRAFT_KEY = 'anamneo:draft:register';

type RegisterRole = 'ADMIN' | 'MEDICO' | 'ASISTENTE';

const ROLE_OPTIONS: Record<RegisterRole, { label: string; description: string }> = {
  ADMIN: {
    label: 'Administrador',
    description: 'Acceso administrativo completo del sistema',
  },
  MEDICO: {
    label: 'Médico',
    description: 'Atención clínica, atenciones y pacientes',
  },
  ASISTENTE: {
    label: 'Asistente',
    description: 'Apoyo clínico y gestión operativa',
  },
};

const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingrese un email válido'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede exceder 72 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/^[A-Za-z\d@$!%*?&]+$/, 'Solo se permiten letras, números y @$!%*?&'),
  confirmPassword: z.string(),
  role: z.enum(['ADMIN', 'MEDICO', 'ASISTENTE']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RegisterRole[]>(['MEDICO', 'ASISTENTE']);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'MEDICO',
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawDraft = window.sessionStorage.getItem(REGISTER_DRAFT_KEY);
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as Partial<RegisterForm>;
      if (typeof draft.nombre === 'string') {
        setValue('nombre', draft.nombre, { shouldValidate: false, shouldDirty: false });
      }
      if (typeof draft.email === 'string') {
        setValue('email', draft.email, { shouldValidate: false, shouldDirty: false });
      }
      if (draft.role === 'ADMIN' || draft.role === 'MEDICO' || draft.role === 'ASISTENTE') {
        setValue('role', draft.role, { shouldValidate: false, shouldDirty: false });
      }
    } catch {
      window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
    }
  }, [setValue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const subscription = watch((value) => {
      const safeDraft = {
        nombre: value.nombre,
        email: value.email,
        role: value.role,
      };
      window.sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(safeDraft));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [watch]);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrapState = async () => {
      try {
        const response = await api.get('/auth/bootstrap');
        if (cancelled) {
          return;
        }

        const rawRoles = response.data?.registerableRoles;
        const parsedRoles = Array.isArray(rawRoles)
          ? rawRoles.filter((role: unknown): role is RegisterRole => (
            role === 'ADMIN' || role === 'MEDICO' || role === 'ASISTENTE'
          ))
          : [];

        const nextRoles = parsedRoles.length > 0 ? parsedRoles : (['MEDICO', 'ASISTENTE'] as RegisterRole[]);
        setAvailableRoles(nextRoles);
        const currentRole = getValues('role');
        const preferredRole = currentRole && nextRoles.includes(currentRole as RegisterRole)
          ? (currentRole as RegisterRole)
          : nextRoles[0];
        setValue('role', preferredRole);
      } catch {
        if (!cancelled) {
          setAvailableRoles(['MEDICO', 'ASISTENTE']);
          const currentRole = getValues('role');
          const preferredRole = currentRole === 'MEDICO' || currentRole === 'ASISTENTE'
            ? currentRole
            : 'MEDICO';
          setValue('role', preferredRole);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoles(false);
        }
      }
    };

    void loadBootstrapState();

    return () => {
      cancelled = true;
    };
  }, [getValues, setValue]);

  const onSubmit = async (data: RegisterForm) => {
    try {
      // Register sets HttpOnly cookies automatically
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        nombre: data.nombre,
        role: data.role,
      });

      // Fetch user profile using the cookie-based session
      const userResponse = await api.get('/auth/me');

      login({
        id: userResponse.data.id,
        email: userResponse.data.email,
        nombre: userResponse.data.nombre || data.nombre,
        role: userResponse.data.role as 'MEDICO' | 'ASISTENTE' | 'ADMIN',
        isAdmin: !!userResponse.data.isAdmin,
        medicoId: userResponse.data.medicoId ?? null,
      });

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      }

      toast.success('¡Cuenta creada exitosamente!');
      router.push('/pacientes');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div>
          <AnamneoLogo
            iconClassName="h-12 w-12"
            textClassName="text-3xl font-bold text-white"
            priority
          />
        </div>

        <div className="text-white">
          <h1 className="text-4xl font-bold mb-6">
            Únete a nuestro<br />sistema clínico
          </h1>
          <p className="text-primary-100 text-lg mb-8">
            Crea tu cuenta para comenzar a gestionar fichas clínicas de forma segura y eficiente.
          </p>
          <div className="space-y-4">
            <div className="auth-bullet">
              <div className="auth-bullet-dot">1</div>
              <span>Registro de pacientes completo</span>
            </div>
            <div className="auth-bullet">
              <div className="auth-bullet-dot">2</div>
              <span>Historial clínico detallado</span>
            </div>
            <div className="auth-bullet">
              <div className="auth-bullet-dot">3</div>
              <span>Sugerencias de diagnóstico con IA</span>
            </div>
          </div>
        </div>

        <p className="text-primary-200 text-sm">
          © {new Date().getFullYear()} Anamneo. Sistema de gestión médica.
        </p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-8">
        <div className="auth-card">
          <div className="mb-8 text-center">
            <AnamneoLogo
              className="justify-center mb-6 lg:hidden"
              iconClassName="h-10 w-10"
              textClassName="text-2xl font-bold text-slate-900"
              priority
            />
            <h2 className="text-2xl font-bold text-slate-900">Crear cuenta</h2>
            <p className="text-slate-600 mt-2">Completa tus datos para registrarte</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">
                Nombre completo
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="nombre"
                  type="text"
                  {...register('nombre')}
                  className={`form-input pl-10 ${errors.nombre ? 'border-red-500' : ''}`}
                  placeholder="Dr. Juan Pérez"
                />
              </div>
              {errors.nombre && (
                <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className={`form-input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="doctor@clinica.cl"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rol
              </label>
              {isLoadingRoles ? (
                <p className="text-xs text-slate-500">Cargando opciones de rol...</p>
              ) : (
                <>
                  <div className="grid gap-3 grid-cols-1">
                    {availableRoles.map((role) => (
                      <label key={role} className="relative">
                        <input
                          type="radio"
                          value={role}
                          {...register('role')}
                          className="peer sr-only"
                        />
                        <div className="p-3 border-2 border-slate-200 rounded-lg cursor-pointer transition-all peer-checked:border-primary-500 peer-checked:bg-primary-50">
                          <p className="text-sm font-medium text-slate-900">{ROLE_OPTIONS[role].label}</p>
                          <p className="text-xs text-slate-600 mt-1">{ROLE_OPTIONS[role].description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    La opción Administrador solo aparece mientras no exista una cuenta administradora activa.
                  </p>
                </>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className={`form-input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Mínimo 8 caracteres, mayúscula, minúscula y número
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  className={`form-input pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoadingRoles}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiUserPlus className="w-5 h-5" />
                  Crear cuenta
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-600 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
