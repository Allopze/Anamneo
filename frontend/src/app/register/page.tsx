'use client';

import { Suspense } from 'react';
import { FiAlertCircle, FiLock, FiMail, FiShield, FiUser, FiUserPlus } from 'react-icons/fi';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import RegisterFooter from './RegisterFooter';
import { RegisterFallback } from './RegisterFallback';
import RegisterLegalAcceptance from './RegisterLegalAcceptance';
import RegisterPasswordFields from './RegisterPasswordFields';
import RegisterRoleField from './RegisterRoleField';
import { useRegisterContent } from './useRegisterContent';

const AUTH_HERO_CHIPS = [
  {
    icon: <FiShield className="h-7 w-7" aria-hidden="true" />,
    label: 'Trazabilidad clínica',
    description: 'Cada acceso queda registrado para auditoría.',
  },
];

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    availableRoles,
    invitationEmail,
    invitationError,
    isInvitationMode,
    requiresBootstrapToken,
    submitError,
    isLoadingRoles,
    isFormBusy,
    legalDocumentsReady,
    legalDocumentsQuery,
    termsDocument,
    privacyDocument,
    register,
    handleSubmit,
    clearErrors,
    errors,
    isSubmitting,
    onSubmit,
  } = useRegisterContent();

  if (isLoadingRoles || legalDocumentsQuery.isLoading) {
    return <RegisterFallback />;
  }

  return (
    <AuthFrame
      variant="loginCompact"
      eyebrow="Acceso clínico"
      title="Acceso seguro a tu espacio clínico."
      description="Consulta y gestiona información clínica con trazabilidad y permisos activos."
      chips={AUTH_HERO_CHIPS}
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
          <span className="auth-badge-accent">
            <FiShield className="h-3.5 w-3.5" /> Invitación validada
          </span>
          <span className="auth-badge">
            <FiLock className="h-3.5 w-3.5" /> Rol fijado
          </span>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {submitError ? <ErrorAlert message={submitError} /> : null}

        {invitationError ? (
          <div className="auth-banner auth-banner-warning flex items-start gap-2" aria-live="polite">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{invitationError}</span>
          </div>
        ) : null}

        {legalDocumentsQuery.isError || !legalDocumentsReady ? (
          <div className="auth-banner auth-banner-warning flex items-start gap-2" aria-live="polite">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              No hay documentos legales vigentes disponibles. Un administrador debe publicar términos y privacidad.
            </span>
          </div>
        ) : null}

        {!isInvitationMode && requiresBootstrapToken ? (
          <div className="auth-banner auth-banner-muted" aria-live="polite">
            Este registro inicial requiere el token de instalación configurado en el servidor.
          </div>
        ) : null}

        <div>
          <label htmlFor="nombre" className="form-label">Nombre completo</label>
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
          <label htmlFor="email" className="form-label">Correo electrónico</label>
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
            <label htmlFor="bootstrapToken" className="form-label">Token de instalación</label>
            <div className="relative">
              <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
              <input
                id="bootstrapToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
                {...register('bootstrapToken', { onChange: () => clearErrors('bootstrapToken') })}
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
