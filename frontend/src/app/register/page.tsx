'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthLogin } from '@/stores/auth-store';
import { stashAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FiAlertCircle, FiLock, FiMail, FiShield, FiUser, FiUserPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getLegalDocumentByType,
  type CurrentLegalDocumentsResponse,
} from '@/lib/legal-content';
import {
  REGISTER_DRAFT_KEY,
  REGISTER_BOOTSTRAP_CHIPS,
  REGISTER_INVITATION_CHIPS,
  registerSchema,
  type RegisterForm,
  type RegisterRole,
} from './register.constants';
import RegisterFooter from './RegisterFooter';
import { RegisterFallback } from './RegisterFallback';
import RegisterLegalAcceptance from './RegisterLegalAcceptance';
import RegisterPasswordFields from './RegisterPasswordFields';
import RegisterRoleField from './RegisterRoleField';

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthLogin();
  const invitationTokenFromQuery = searchParams.get('token')?.trim() || null;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RegisterRole[]>(['ADMIN']);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationMode, setIsInvitationMode] = useState(false);
  const [requiresBootstrapToken, setRequiresBootstrapToken] = useState(false);
  const registerDraftWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegisterDraftRef = useRef<string | null>(null);
  const bootstrapQuery = useQuery({
    queryKey: ['auth', 'bootstrap'],
    queryFn: () => api.get('/auth/bootstrap').then((r) => r.data as { hasAdmin: boolean; requiresBootstrapToken?: boolean }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const invitationQuery = useQuery({
    queryKey: ['auth', 'invitation', invitationTokenFromQuery],
    queryFn: () => api.get(`/auth/invitations/${invitationTokenFromQuery}`).then((r) => r.data as { role: RegisterRole; email: string }),
    enabled: Boolean(bootstrapQuery.data?.hasAdmin && invitationTokenFromQuery),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const legalDocumentsQuery = useQuery({
    queryKey: ['legal-documents', 'current'],
    queryFn: async () => {
      const response = await api.get('/legal/documents/current');
      return response.data as CurrentLegalDocumentsResponse;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

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
      acceptedLegal: false,
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
      pendingRegisterDraftRef.current = JSON.stringify(safeDraft);

      if (registerDraftWriteTimerRef.current) {
        clearTimeout(registerDraftWriteTimerRef.current);
      }

      registerDraftWriteTimerRef.current = setTimeout(() => {
        if (pendingRegisterDraftRef.current) {
          window.sessionStorage.setItem(REGISTER_DRAFT_KEY, pendingRegisterDraftRef.current);
        }
      }, 300);
    });

    return () => {
      if (registerDraftWriteTimerRef.current) {
        clearTimeout(registerDraftWriteTimerRef.current);
      }
      if (pendingRegisterDraftRef.current) {
        window.sessionStorage.setItem(REGISTER_DRAFT_KEY, pendingRegisterDraftRef.current);
      }
      subscription.unsubscribe();
    };
  }, [watch]);

  // Sync derived registration state from query results
  useEffect(() => {
    if (bootstrapQuery.isLoading) return;

    if (bootstrapQuery.isError) {
      setInvitationError('No fue posible cargar el estado de registro.');
      return;
    }

    const hasAdmin = bootstrapQuery.data?.hasAdmin;

    if (hasAdmin) {
      setIsInvitationMode(true);
      setRequiresBootstrapToken(false);

      if (!invitationTokenFromQuery) {
        setInvitationError('Necesita una invitación válida para crear una cuenta.');
        setAvailableRoles([]);
        return;
      }

      if (invitationQuery.isLoading) return;

      if (invitationQuery.isError) {
        setAvailableRoles([]);
        setInvitationError('La invitación es inválida o expiró.');
        return;
      }

      if (invitationQuery.data) {
        const { role, email } = invitationQuery.data;
        setInvitationToken(invitationTokenFromQuery);
        setInvitationEmail(email);
        setAvailableRoles([role]);
        setValue('role', role, { shouldValidate: false, shouldDirty: false });
        setValue('email', email, { shouldValidate: false, shouldDirty: false });
        setInvitationError(null);
      }
    } else {
      setIsInvitationMode(false);
      setRequiresBootstrapToken(Boolean(bootstrapQuery.data?.requiresBootstrapToken));
      setInvitationToken(null);
      setInvitationEmail(null);
      setAvailableRoles(['ADMIN']);
      setValue('role', 'ADMIN', { shouldValidate: false, shouldDirty: false });
      setInvitationError(null);
    }
  }, [
    bootstrapQuery.isLoading,
    bootstrapQuery.isError,
    bootstrapQuery.data,
    invitationQuery.isLoading,
    invitationQuery.isError,
    invitationQuery.data,
    invitationTokenFromQuery,
    setValue,
  ]);

  const termsDocument = getLegalDocumentByType(legalDocumentsQuery.data, 'TERMS');
  const privacyDocument = getLegalDocumentByType(legalDocumentsQuery.data, 'PRIVACY');
  const legalDocumentsReady = Boolean(termsDocument?.version && privacyDocument?.version);
  const isLoadingRoles = bootstrapQuery.isLoading || invitationQuery.isLoading;
  const isFormBusy = isSubmitting || isLoadingRoles || legalDocumentsQuery.isLoading;
  const registerChips = isInvitationMode ? REGISTER_INVITATION_CHIPS : REGISTER_BOOTSTRAP_CHIPS;

  const onSubmit = async (data: RegisterForm) => {
    setSubmitError(null);

    if (!termsDocument || !privacyDocument) {
      toast.error('No hay documentos legales vigentes publicados para completar el registro.');
      return;
    }

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
        acceptedTermsVersion: termsDocument.version,
        acceptedPrivacyVersion: privacyDocument.version,
      });

      const sessionUser = registerResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);

      if (typeof window !== 'undefined') {
        if (registerDraftWriteTimerRef.current) {
          clearTimeout(registerDraftWriteTimerRef.current);
          registerDraftWriteTimerRef.current = null;
        }
        pendingRegisterDraftRef.current = null;
        window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      }

      toast.success('¡Cuenta creada exitosamente!');
      router.push('/');
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  if (isLoadingRoles || legalDocumentsQuery.isLoading) {
    return <RegisterFallback />;
  }

  return (
    <AuthFrame
      variant="loginCompact"
      eyebrow={isInvitationMode ? 'Invitación' : 'Configuración Inicial'}
      title={
        isInvitationMode
          ? 'Activa tu cuenta para operar.'
          : 'Primera cuenta del espacio clínico.'
      }
      description={
        isInvitationMode
          ? 'Completa tus datos para activar el acceso asignado por el administrador.'
          : 'Crea la cuenta administradora inicial para habilitar el espacio clínico.'
      }
      chips={registerChips}
      heroFooter={
        <div className="auth-help">
          <FiLock className="h-7 w-7" aria-hidden="true" />
          <span>
            <span className="auth-help-title">Cifrado de extremo a extremo</span>
            <span className="auth-help-copy">Tus datos viajan y se almacenan cifrados.</span>
          </span>
        </div>
      }
      cardEyebrow="Registro"
      cardTitle="Crear cuenta"
      cardDescription="Completa los datos para habilitar el acceso."
      logoIconClassName="!h-14 !w-14 lg:!h-20 lg:!w-20"
      logoTextClassName="!text-3xl lg:!text-4xl"
      footer={<RegisterFooter />}
    >
      {isInvitationMode && (
        <div className="auth-note">
          <span className="auth-badge-accent"><FiShield className="h-3.5 w-3.5" /> Invitación validada</span>
          <span className="auth-badge"><FiLock className="h-3.5 w-3.5" /> Rol fijado</span>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {submitError ? (
          <ErrorAlert message={submitError} />
        ) : null}

        {invitationError ? (
          <div className="auth-banner auth-banner-warning flex items-start gap-2" aria-live="polite">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{invitationError}</span>
          </div>
        ) : null}

        {legalDocumentsQuery.isError || !legalDocumentsReady ? (
          <div className="auth-banner auth-banner-warning flex items-start gap-2" aria-live="polite">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>No hay documentos legales vigentes disponibles. Un administrador debe publicar términos y privacidad.</span>
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

        <RegisterRoleField
          register={register}
          availableRoles={availableRoles}
          isInvitationMode={isInvitationMode}
          isLoadingRoles={isLoadingRoles}
          disabled={isFormBusy}
        />

        <RegisterPasswordFields
          disabled={isFormBusy}
          errors={errors}
          register={register}
          setShowConfirmPassword={setShowConfirmPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          showPassword={showPassword}
        />

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

        <RegisterLegalAcceptance
          register={register}
          error={errors.acceptedLegal}
          disabled={isFormBusy}
          termsVersion={termsDocument?.version ?? null}
          privacyVersion={privacyDocument?.version ?? null}
        />

        <button
          type="submit"
          disabled={isFormBusy || !!invitationError || !legalDocumentsReady}
          className="btn btn-accent w-full gap-2 py-3"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2" aria-live="polite">
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
