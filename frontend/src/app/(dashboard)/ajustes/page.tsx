'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  getDefaultInvitationTemplateHtml,
  getDefaultInvitationSubjectTemplate,
  INVITATION_TEMPLATE_PRESETS,
  INVITATION_TEMPLATE_TOKENS,
  renderInvitationTextTemplate,
  renderInvitationTemplatePreview,
} from '@/lib/invitation-email-templates';
import { useAuthStore } from '@/stores/auth-store';

const profileSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Requerido'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72, 'Máximo 72 caracteres')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Debe contener mayúscula, minúscula y número')
      .regex(/^\S+$/, 'No puede contener espacios'),
    confirmPassword: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function AjustesPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = !!user?.isAdmin;
  const [showPassword, setShowPassword] = useState(false);
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
  const [previewSeed] = useState(() => new Date());
  const [clinic, setClinic] = useState({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    clinicEmail: '',
    appPublicUrl: '',
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: '',
    invitationSubject: getDefaultInvitationSubjectTemplate(),
    invitationTemplateHtml: getDefaultInvitationTemplateHtml(),
  });
  const [testEmail, setTestEmail] = useState('');

  const {
    register: registerProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre: user?.nombre ?? '',
      email: user?.email ?? '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data as Record<string, string>,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings) {
      setClinic({
        clinicName: settings['clinic.name'] || '',
        clinicAddress: settings['clinic.address'] || '',
        clinicPhone: settings['clinic.phone'] || '',
        clinicEmail: settings['clinic.email'] || '',
        appPublicUrl: settings['app.publicUrl'] || '',
        smtpHost: settings['smtp.host'] || '',
        smtpPort: settings['smtp.port'] || '587',
        smtpSecure: settings['smtp.secure'] === 'true',
        smtpUser: settings['smtp.user'] || '',
        smtpPassword: '',
        smtpFromEmail: settings['smtp.fromEmail'] || '',
        smtpFromName: settings['smtp.fromName'] || '',
        invitationSubject: settings['email.invitationSubject'] || getDefaultInvitationSubjectTemplate(),
        invitationTemplateHtml: settings['email.invitationTemplateHtml'] || getDefaultInvitationTemplateHtml(),
      });
      setSmtpPasswordConfigured(settings['smtp.passwordConfigured'] === 'true');
    }
  }, [settings]);

  useEffect(() => {
    if (!testEmail && user?.email) {
      setTestEmail(user.email);
    }
  }, [testEmail, user?.email]);

  const previewBaseUrl = useMemo(() => {
    const configured = clinic.appPublicUrl.trim().replace(/\/+$/, '');
    if (configured) {
      return configured;
    }

    if (typeof window !== 'undefined') {
      return window.location.origin;
    }

    return 'http://localhost:5555';
  }, [clinic.appPublicUrl]);

  const currentPresetId = useMemo(() => {
    return INVITATION_TEMPLATE_PRESETS.find(
      (preset) => preset.html === clinic.invitationTemplateHtml,
    )?.id || null;
  }, [clinic.invitationTemplateHtml]);

  const previewExpirationLabel = useMemo(() => {
    return new Date(previewSeed.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, [previewSeed]);

  const previewYear = useMemo(() => String(previewSeed.getFullYear()), [previewSeed]);

  const invitationTemplatePreview = useMemo(() => {
    return renderInvitationTemplatePreview(clinic.invitationTemplateHtml, {
      clinicName: clinic.clinicName || 'Anamneo',
      recipientEmail: 'equipo@ejemplo.cl',
      inviteUrl: `${previewBaseUrl}/register?token=demo-token-123`,
      roleLabel: 'medico',
      expirationLabel: previewExpirationLabel,
      assignedMedicoName: 'Dra. Elena Rojas',
      assignedMedicoSection: '<p style="margin:0 0 12px; color:#475569;">Medico asignado: <strong>Dra. Elena Rojas</strong></p>',
      logoUrl: `${previewBaseUrl}/anamneo-logo.svg`,
      year: previewYear,
    });
  }, [clinic.clinicName, clinic.invitationTemplateHtml, previewBaseUrl, previewExpirationLabel, previewYear]);

  const invitationSubjectPreview = useMemo(() => {
    return renderInvitationTextTemplate(clinic.invitationSubject, {
      clinicName: clinic.clinicName || 'Anamneo',
      recipientEmail: testEmail || user?.email || 'equipo@ejemplo.cl',
      inviteUrl: `${previewBaseUrl}/register?token=demo-token-123`,
      roleLabel: 'medico',
      expirationLabel: previewExpirationLabel,
      assignedMedicoName: 'Dra. Elena Rojas',
      assignedMedicoSection: 'Dra. Elena Rojas',
      logoUrl: `${previewBaseUrl}/anamneo-logo.svg`,
      year: previewYear,
    });
  }, [clinic.clinicName, clinic.invitationSubject, previewBaseUrl, previewExpirationLabel, previewYear, testEmail, user?.email]);

  const buildSettingsPayload = () => {
    const payload: Record<string, string | boolean> = {
      clinicName: clinic.clinicName,
      clinicAddress: clinic.clinicAddress,
      clinicPhone: clinic.clinicPhone,
      clinicEmail: clinic.clinicEmail,
      appPublicUrl: clinic.appPublicUrl,
      smtpHost: clinic.smtpHost,
      smtpPort: clinic.smtpPort,
      smtpSecure: clinic.smtpSecure,
      smtpUser: clinic.smtpUser,
      smtpFromEmail: clinic.smtpFromEmail,
      smtpFromName: clinic.smtpFromName,
      invitationSubject: clinic.invitationSubject,
      invitationTemplateHtml: clinic.invitationTemplateHtml,
    };

    if (clinic.smtpPassword.trim().length > 0) {
      payload.smtpPassword = clinic.smtpPassword;
    }

    return payload;
  };

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/profile', data),
    onSuccess: (res) => {
      const updated = res.data;
      setUser({ ...user!, nombre: updated.nombre, email: updated.email });
      toast.success('Perfil actualizado');
    },
    onError: () => toast.error('Error al actualizar perfil'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      toast.success('Contraseña actualizada');
      resetPasswordForm();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Error al cambiar contraseña';
      toast.error(msg);
    },
  });

  const clinicMutation = useMutation({
    mutationFn: () => api.put('/settings', buildSettingsPayload()),
    onSuccess: () => {
      setClinic((current) => ({ ...current, smtpPassword: '' }));
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error('Error al guardar configuración'),
  });

  const testInvitationMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/mail/test-invitation', {
        email: testEmail,
        clinicName: clinic.clinicName,
        appPublicUrl: clinic.appPublicUrl,
        smtpHost: clinic.smtpHost,
        smtpPort: clinic.smtpPort,
        smtpSecure: clinic.smtpSecure,
        smtpUser: clinic.smtpUser,
        smtpFromEmail: clinic.smtpFromEmail,
        smtpFromName: clinic.smtpFromName,
        invitationSubject: clinic.invitationSubject,
        invitationTemplateHtml: clinic.invitationTemplateHtml,
        ...(clinic.smtpPassword.trim().length > 0 ? { smtpPassword: clinic.smtpPassword } : {}),
      });
      return response.data as {
        sent: boolean;
        reason: string | null;
        subject: string | null;
      };
    },
    onSuccess: (result) => {
      if (result.sent) {
        toast.success(`Correo de prueba enviado${result.subject ? `: ${result.subject}` : ''}`);
        return;
      }

      toast.error(result.reason || 'No se pudo enviar el correo de prueba');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'No se pudo enviar el correo de prueba';
      toast.error(typeof msg === 'string' ? msg : 'No se pudo enviar el correo de prueba');
    },
  });

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Ajustes</h1>
          <p className="page-header-description">Perfil, seguridad y configuración general del centro.</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Datos personales</h2>
        </div>
        <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-ink-secondary mb-1">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              {...registerProfile('nombre')}
              className="input w-full"
            />
            {profileErrors.nombre && (
              <p className="text-status-red text-xs mt-1">{profileErrors.nombre.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...registerProfile('email')}
              className="input w-full"
            />
            {profileErrors.email && (
              <p className="text-status-red text-xs mt-1">{profileErrors.email.message}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              Rol: <strong>{user?.role}</strong>
            </span>
          </div>
          <button
            type="submit"
            disabled={!profileDirty || profileMutation.isPending}
            className="btn btn-primary"
          >
            {profileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Cambiar contraseña</h2>
        </div>
        <form
          onSubmit={handlePassword((d) => passwordMutation.mutate(d))}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-ink-secondary mb-1"
            >
              Contraseña actual
            </label>
            <input
              id="currentPassword"
              type={showPassword ? 'text' : 'password'}
              {...registerPassword('currentPassword')}
              className="input w-full"
            />
            {passwordErrors.currentPassword && (
              <p className="text-status-red text-xs mt-1">
                {passwordErrors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-ink-secondary mb-1"
            >
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              {...registerPassword('newPassword')}
              className="input w-full"
            />
            {passwordErrors.newPassword && (
              <p className="text-status-red text-xs mt-1">{passwordErrors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-ink-secondary mb-1"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              {...registerPassword('confirmPassword')}
              className="input w-full"
            />
            {passwordErrors.confirmPassword && (
              <p className="text-status-red text-xs mt-1">
                {passwordErrors.confirmPassword.message}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
            />
            Mostrar contraseñas
          </label>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="btn btn-primary"
          >
            {passwordMutation.isPending ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>

      {user?.isAdmin && (
        <>
          <div className="card mb-6 border-accent/20">
            <div className="panel-header">
              <h2 className="panel-title">Datos del centro médico</h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Esta información se usa en fichas impresas, exportaciones y como fallback para los correos enviados por el sistema.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Nombre del centro</label>
                <input
                  type="text"
                  className="input w-full"
                  value={clinic.clinicName}
                  onChange={(e) => setClinic(c => ({ ...c, clinicName: e.target.value }))}
                  placeholder="Ej: Centro Médico San Pablo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Dirección</label>
                <input
                  type="text"
                  className="input w-full"
                  value={clinic.clinicAddress}
                  onChange={(e) => setClinic(c => ({ ...c, clinicAddress: e.target.value }))}
                  placeholder="Ej: Av. Providencia 1234, Santiago"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Teléfono</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={clinic.clinicPhone}
                    onChange={(e) => setClinic(c => ({ ...c, clinicPhone: e.target.value }))}
                    placeholder="+56 2 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Email</label>
                  <input
                    type="email"
                    className="input w-full"
                    value={clinic.clinicEmail}
                    onChange={(e) => setClinic(c => ({ ...c, clinicEmail: e.target.value }))}
                    placeholder="contacto@centro.cl"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => clinicMutation.mutate()}
                disabled={clinicMutation.isPending}
                className="btn btn-primary"
              >
                {clinicMutation.isPending ? 'Guardando...' : 'Guardar datos del centro'}
              </button>
            </div>
          </div>

          <div className="card mb-6 border-accent/20">
            <div className="panel-header">
              <h2 className="panel-title">Correo SMTP para invitaciones</h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Se usa para enviar automáticamente las invitaciones creadas desde administración. Si queda incompleto, el sistema seguirá generando el enlace manual como respaldo.
            </p>
            <div className="mb-4 rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-4 text-sm text-ink-secondary">
              <p className="font-medium text-ink-primary">Fallback por `.env`</p>
              <p className="mt-1">
                Si dejas campos vacíos aquí, el backend usa los valores definidos en `.env`: `APP_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` e `INVITATION_EMAIL_SUBJECT`.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">URL pública del frontend</label>
                <input
                  type="url"
                  className="input w-full"
                  value={clinic.appPublicUrl}
                  onChange={(e) => setClinic(c => ({ ...c, appPublicUrl: e.target.value }))}
                  placeholder="https://anamneo.tu-dominio.cl"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Host SMTP</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={clinic.smtpHost}
                    onChange={(e) => setClinic(c => ({ ...c, smtpHost: e.target.value }))}
                    placeholder="smtp.tu-proveedor.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Puerto</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={clinic.smtpPort}
                    onChange={(e) => setClinic(c => ({ ...c, smtpPort: e.target.value }))}
                    placeholder="587"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={clinic.smtpSecure}
                  onChange={(e) => setClinic(c => ({ ...c, smtpSecure: e.target.checked }))}
                />
                Usar conexión segura SSL/TLS
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Usuario SMTP</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={clinic.smtpUser}
                    onChange={(e) => setClinic(c => ({ ...c, smtpUser: e.target.value }))}
                    placeholder="usuario@tu-proveedor.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Clave SMTP</label>
                  <input
                    type="password"
                    className="input w-full"
                    value={clinic.smtpPassword}
                    onChange={(e) => setClinic(c => ({ ...c, smtpPassword: e.target.value }))}
                    placeholder={smtpPasswordConfigured ? 'Configurada (dejar vacío para mantenerla)' : '••••••••'}
                  />
                  {smtpPasswordConfigured && !clinic.smtpPassword.trim() && (
                    <p className="mt-2 text-xs text-ink-muted">
                      Ya existe una clave SMTP guardada. Este campo solo se usa para reemplazarla.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Remitente</label>
                  <input
                    type="email"
                    className="input w-full"
                    value={clinic.smtpFromEmail}
                    onChange={(e) => setClinic(c => ({ ...c, smtpFromEmail: e.target.value }))}
                    placeholder="no-reply@tu-centro.cl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Nombre remitente</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={clinic.smtpFromName}
                    onChange={(e) => setClinic(c => ({ ...c, smtpFromName: e.target.value }))}
                    placeholder="Anamneo"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Asunto del correo</label>
                <input
                  type="text"
                  className="input w-full"
                  value={clinic.invitationSubject}
                  onChange={(e) => setClinic(c => ({ ...c, invitationSubject: e.target.value }))}
                  placeholder="Invitacion a {{clinicName}}"
                />
                <p className="mt-2 text-xs text-ink-muted">
                  Vista previa: <strong>{invitationSubjectPreview}</strong>
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Correo para prueba</label>
                  <input
                    type="email"
                    className="input w-full"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="admin@tu-centro.cl"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => testInvitationMutation.mutate()}
                  disabled={testInvitationMutation.isPending || !testEmail.trim()}
                  className="btn btn-secondary"
                >
                  {testInvitationMutation.isPending ? 'Enviando prueba...' : 'Enviar prueba'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => clinicMutation.mutate()}
                disabled={clinicMutation.isPending}
                className="btn btn-primary"
              >
                {clinicMutation.isPending ? 'Guardando...' : 'Guardar correo SMTP'}
              </button>
            </div>
          </div>

          <div className="card mb-6 border-accent/20">
            <div className="panel-header">
              <h2 className="panel-title">Plantillas de bienvenida HTML</h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Elige una base, ajusta el HTML y revisa la previsualizacion antes de guardar. Todas las opciones incluyen el logo institucional usando <strong>{'{{logoUrl}}'}</strong>.
            </p>

            <div className="grid gap-3 lg:grid-cols-3 mb-5">
              {INVITATION_TEMPLATE_PRESETS.map((preset) => {
                const isActive = currentPresetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setClinic((current) => ({ ...current, invitationTemplateHtml: preset.html }))}
                    className={`rounded-2xl border p-4 text-left transition-colors ${isActive ? 'border-accent/80 bg-accent/10' : 'border-surface-muted/30 bg-surface-elevated hover:border-accent/60'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-ink-primary">{preset.name}</h3>
                      {isActive && <span className="text-xs font-medium text-accent">Activa</span>}
                    </div>
                    <p className="mt-2 text-sm text-ink-secondary">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-4 mb-5">
              <p className="text-sm font-medium text-ink-primary">Placeholders disponibles</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INVITATION_TEMPLATE_TOKENS.map((token) => (
                  <span key={token} className="rounded-full border border-surface-muted/30 bg-surface-elevated px-3 py-1 text-xs text-ink-secondary">
                    {token}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-ink-secondary">Editor HTML</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setClinic((current) => ({
                      ...current,
                      invitationTemplateHtml: getDefaultInvitationTemplateHtml(),
                    }))}
                  >
                    Restaurar base
                  </button>
                </div>
                <textarea
                  className="input w-full min-h-[34rem] font-mono text-xs leading-6"
                  value={clinic.invitationTemplateHtml}
                  onChange={(e) => setClinic((current) => ({ ...current, invitationTemplateHtml: e.target.value }))}
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-2">Previsualizador HTML</label>
                <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-3">
                  <iframe
                    title="Previsualizacion plantilla bienvenida"
                    srcDoc={invitationTemplatePreview}
                    sandbox=""
                    className="h-[34rem] w-full rounded-xl border border-surface-muted/30 bg-surface-elevated"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => clinicMutation.mutate()}
                disabled={clinicMutation.isPending}
                className="btn btn-primary"
              >
                {clinicMutation.isPending ? 'Guardando...' : 'Guardar plantilla de bienvenida'}
              </button>
              <p className="text-xs text-ink-muted">
                Se enviara en correos reales usando el logo de {previewBaseUrl}/anamneo-logo.svg.
              </p>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="panel-header">
          <h2 className="panel-title">Información del sistema</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p>
            <strong>Versión:</strong> 1.0.0
          </p>
          <p>
            <strong>API:</strong> {process.env.NEXT_PUBLIC_API_URL}
          </p>
        </div>
      </div>
    </div>
  );
}
