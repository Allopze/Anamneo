'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthLogin } from '@/stores/auth-store';
import { stashAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiShield, FiUser, FiUserPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  REGISTER_DRAFT_KEY,
  ROLE_OPTIONS,
  REGISTER_BOOTSTRAP_CHIPS,
  REGISTER_INVITATION_CHIPS,
  registerSchema,
  type RegisterForm,
  type RegisterRole,
} from './register.constants';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-shell">
          <div className="status-card max-w-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="mt-4 text-sm text-ink-muted">Cargando registro...</p>
          </div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthLogin();
  const invitationTokenFromQuery = searchParams.get('token')?.trim() || null;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RegisterRole[]>(['ADMIN']);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationMode, setIsInvitationMode] = useState(false);
  const [requiresBootstrapToken, setRequiresBootstrapToken] = useState(false);

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
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
          setRequiresBootstrapToken(false);

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
  setRequiresBootstrapToken(Boolean(response.data?.requiresBootstrapToken));
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
  const registerChips = isInvitationMode ? REGISTER_INVITATION_CHIPS : REGISTER_BOOTSTRAP_CHIPS;

  const onSubmit = async (data: RegisterForm) => {
    const bootstrapToken = data.bootstrapToken?.trim();

    if (requiresBootstrapToken && !bootstrapToken) {
      setError('bootstrapToken', {
        type: 'manual',
        message: 'Ingresa el token de instalación para habilitar el primer administrador.',
      });
      return;
    }

    try {
      // Register sets HttpOnly cookies automatically
      const registerResponse = await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        nombre: data.nombre,
        role: data.role,
        invitationToken: invitationToken || undefined,
        bootstrapToken: requiresBootstrapToken ? bootstrapToken : undefined,
      });

      const sessionUser = registerResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      }

      toast.success('¡Cuenta creada exitosamente!');
      router.push('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AuthFrame
      eyebrow={isInvitationMode ? 'Invitación' : 'Configuración Inicial'}
      title={
        isInvitationMode
          ? 'Activa tu cuenta para operar.'
          : 'Primera cuenta del espacio clínico.'
      }
      chips={registerChips}
      cardEyebrow="Registro"
      cardTitle="Crear cuenta"
      cardDescription="Completa los datos para habilitar el acceso."
      footer={
        <p className="text-center text-ink-secondary">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="auth-inline-link">
            Iniciar sesión <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      }
    >
      {isInvitationMode && (
        <div className="auth-note">
          <span className="auth-badge-accent"><FiShield className="h-3.5 w-3.5" /> Invitación validada</span>
          <span className="auth-badge"><FiLock className="h-3.5 w-3.5" /> Rol fijado</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {invitationError ? (
          <div className="auth-banner auth-banner-warning" aria-live="polite">
            {invitationError}
          </div>
        ) : null}

        {isLoadingRoles ? (
          <div className="auth-banner auth-banner-muted" aria-live="polite">
            Validando si este registro requiere invitación…
          </div>
        ) : null}

        {!isInvitationMode && requiresBootstrapToken ? (
          <div className="auth-banner auth-banner-muted" aria-live="polite">
            Este registro inicial requiere el token de instalación configurado en el servidor.
          </div>
        ) : null}

        <div>
          <label htmlFor="nombre" className="form-label">
            Nombre completo
          </label>
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              {...register('nombre')}
              disabled={isFormBusy}
              className={`form-input pl-10 ${errors.nombre ? 'form-input-error' : ''}`}
              placeholder="Dra. Camila Soto"
              aria-invalid={!!errors.nombre}
              aria-describedby={errors.nombre ? 'nombre-error' : undefined}
            />
          </div>
          {errors.nombre ? (
            <p id="nombre-error" className="form-error" role="alert">
              {errors.nombre.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="form-label">
            Correo electrónico
          </label>
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              {...register('email')}
              disabled={isFormBusy}
              readOnly={!isLoadingRoles && isInvitationMode && !!invitationEmail}
              className={`form-input pl-10 ${errors.email ? 'form-input-error' : ''}`}
              placeholder="equipo@clinica.cl"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
          {errors.email ? (
            <p id="email-error" className="form-error" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="form-label">Rol</label>
          {isLoadingRoles ? (
            <p className="text-micro text-ink-muted">Cargando opciones disponibles…</p>
          ) : isInvitationMode && availableRoles.length === 1 ? (
            <>
              <input type="hidden" value={availableRoles[0]} {...register('role')} />
              <div className="auth-role-pill">
                <FiLock className="auth-role-pill-icon" aria-hidden="true" />
                {ROLE_OPTIONS[availableRoles[0]].label}
              </div>
              <p className="mt-2 text-micro text-ink-muted">Rol fijado por invitación.</p>
            </>
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
                    <div className="auth-role-card peer-checked:border-accent peer-checked:bg-accent/10">
                      <div
                        className="auth-role-indicator peer-checked:border-accent peer-checked:bg-accent"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary">{ROLE_OPTIONS[role].label}</p>
                        <p className="mt-1 text-xs text-ink-secondary">{ROLE_OPTIONS[role].description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-micro text-ink-muted">
                Solo esta alta inicial habilita la cuenta administradora base.
              </p>
            </>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                disabled={isFormBusy}
                className={`form-input pl-10 pr-10 ${errors.password ? 'form-input-error' : ''}`}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby="password-help password-error"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink-secondary"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="form-error" role="alert">
                {errors.password.message}
              </p>
            ) : null}
            <p id="password-help" className="mt-1 text-micro text-ink-muted">
              Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="form-label">
              Confirmar contraseña
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                disabled={isFormBusy}
                className={`form-input pl-10 pr-10 ${errors.confirmPassword ? 'form-input-error' : ''}`}
                placeholder="••••••••"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink-secondary"
                aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
              >
                {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword ? (
              <p id="confirm-password-error" className="form-error" role="alert">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>
        </div>

        {!isInvitationMode && requiresBootstrapToken ? (
          <div>
            <label htmlFor="bootstrapToken" className="form-label">
              Token de instalación
            </label>
            <div className="relative">
              <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
              <input
                id="bootstrapToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
                {...register('bootstrapToken', {
                  onChange: () => clearErrors('bootstrapToken'),
                })}
                disabled={isFormBusy}
                className={`form-input pl-10 ${errors.bootstrapToken ? 'form-input-error' : ''}`}
                placeholder="Token privado de instalación"
                aria-invalid={!!errors.bootstrapToken}
                aria-describedby={errors.bootstrapToken ? 'bootstrap-token-error' : 'bootstrap-token-help'}
              />
            </div>
            {errors.bootstrapToken ? (
              <p id="bootstrap-token-error" className="form-error" role="alert">
                {errors.bootstrapToken.message}
              </p>
            ) : null}
            <p id="bootstrap-token-help" className="mt-1 text-micro text-ink-muted">
              Solo se usa para crear la primera cuenta administradora cuando el sistema todavía no tiene admins.
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isFormBusy || !!invitationError}
          className="btn btn-accent w-full gap-2 py-3"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2" aria-live="polite">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creando cuenta…
            </span>
          ) : (
            <>
              <FiUserPlus className="w-5 h-5" aria-hidden="true" />
              Crear cuenta
            </>
          )}
        </button>
      </form>
    </AuthFrame>
  );
}
