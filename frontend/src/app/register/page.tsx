'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    .regex(/^\S+$/, 'La contraseña no puede contener espacios'),
  confirmPassword: z.string(),
  role: z.enum(['ADMIN', 'MEDICO', 'ASISTENTE']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const invitationTokenFromQuery = searchParams.get('token')?.trim() || null;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RegisterRole[]>(['ADMIN']);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationMode, setIsInvitationMode] = useState(false);

  const {
    register,
    handleSubmit,
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

        if (response.data?.hasAdmin) {
          setIsInvitationMode(true);

          if (!invitationTokenFromQuery) {
            setInvitationError('Necesita una invitación válida para crear una cuenta.');
            setAvailableRoles([]);
            return;
          }

          try {
            const invitationResponse = await api.get(`/auth/invitations/${invitationTokenFromQuery}`);
            if (cancelled) {
              return;
            }

            const role = invitationResponse.data.role as RegisterRole;
            const email = invitationResponse.data.email as string;

            setInvitationToken(invitationTokenFromQuery);
            setInvitationEmail(email);
            setAvailableRoles([role]);
            setValue('role', role, { shouldValidate: false, shouldDirty: false });
            setValue('email', email, { shouldValidate: false, shouldDirty: false });
            setInvitationError(null);
          } catch {
            if (!cancelled) {
              setAvailableRoles([]);
              setInvitationError('La invitación es inválida o expiró.');
            }
          }

          return;
        }

        setIsInvitationMode(false);
        setInvitationToken(null);
        setInvitationEmail(null);
        setAvailableRoles(['ADMIN']);
        setValue('role', 'ADMIN', { shouldValidate: false, shouldDirty: false });
        setInvitationError(null);
      } catch {
        if (!cancelled) {
          setInvitationError('No fue posible cargar el estado de registro.');
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
  }, [invitationTokenFromQuery, setValue]);

  const isFormBusy = isSubmitting || isLoadingRoles;

  const onSubmit = async (data: RegisterForm) => {
    try {
      // Register sets HttpOnly cookies automatically
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        nombre: data.nombre,
        role: data.role,
        invitationToken: invitationToken || undefined,
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
          <p className="text-accent text-lg mb-8">
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

        <p className="text-accent/80 text-sm">
          © {new Date().getFullYear()} Anamneo. Sistema de gestión médica.
        </p>
      </div>

      <div className="flex items-center justify-center bg-surface-base/40 p-8">
        <div className="auth-card">
          <div className="mb-8 text-center">
            <AnamneoLogo
              className="justify-center mb-6 lg:hidden"
              iconClassName="h-10 w-10"
              textClassName="text-2xl font-bold text-ink-primary"
              priority
            />
            <h2 className="text-2xl font-bold text-ink-primary">Crear cuenta</h2>
            <p className="text-ink-secondary mt-2">Completa tus datos para registrarte</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {invitationError && (
              <div className="rounded-card border border-status-yellow/30 bg-status-yellow/20 px-4 py-3 text-sm text-status-yellow">
                {invitationError}
              </div>
            )}

            {isLoadingRoles && (
              <div className="rounded-card border border-surface-muted/30 bg-surface-base/40 px-4 py-3 text-sm text-ink-secondary">
                Validando si este registro requiere invitación...
              </div>
            )}

            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-ink-secondary mb-1">
                Nombre completo
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                <input
                  id="nombre"
                  type="text"
                  {...register('nombre')}
                  disabled={isFormBusy}
                  className={`form-input pl-10 ${errors.nombre ? 'border-status-red' : ''}`}
                  placeholder="Dr. Juan Pérez"
                />
              </div>
              {errors.nombre && (
                <p className="text-status-red text-sm mt-1">{errors.nombre.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={isFormBusy}
                  readOnly={!isLoadingRoles && isInvitationMode && !!invitationEmail}
                  className={`form-input pl-10 ${errors.email ? 'border-status-red' : ''}`}
                  placeholder="doctor@clinica.cl"
                />
              </div>
              {errors.email && (
                <p className="text-status-red text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Rol
              </label>
              {isLoadingRoles ? (
                <p className="text-xs text-ink-muted">Cargando opciones de rol...</p>
              ) : (
                <>
                  <div className="grid gap-3 grid-cols-1">
                    {availableRoles.map((role) => (
                      <label key={role} className="relative">
                        <input
                          type="radio"
                          value={role}
                          {...register('role')}
                          disabled={isFormBusy}
                          className="peer sr-only"
                        />
                        <div className="p-3 border-2 border-surface-muted/30 rounded-card cursor-pointer transition-all peer-checked:border-accent peer-checked:bg-accent/10">
                          <p className="text-sm font-medium text-ink-primary">{ROLE_OPTIONS[role].label}</p>
                          <p className="text-xs text-ink-secondary mt-1">{ROLE_OPTIONS[role].description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted mt-2">
                    {isInvitationMode
                      ? 'El rol fue definido por la invitación.'
                      : 'Solo el primer registro crea la cuenta administradora inicial.'}
                  </p>
                </>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-secondary mb-1">
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  disabled={isFormBusy}
                  className={`form-input pl-10 pr-10 ${errors.password ? 'border-status-red' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-status-red text-sm mt-1">{errors.password.message}</p>
              )}
              <p className="text-xs text-ink-muted mt-1">
                Mínimo 8 caracteres, mayúscula, minúscula y número
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-secondary mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  disabled={isFormBusy}
                  className={`form-input pl-10 pr-10 ${errors.confirmPassword ? 'border-status-red' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                >
                  {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-status-red text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isFormBusy || !!invitationError}
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

          <p className="text-center text-ink-secondary mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-accent hover:text-accent/80 font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
