import { useEffect, useMemo, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  getDefaultInvitationTemplateHtml,
  getDefaultInvitationSubjectTemplate,
  INVITATION_TEMPLATE_PRESETS,
  renderInvitationTextTemplate,
  renderInvitationTemplatePreview,
} from '@/lib/invitation-email-templates';

type Params = {
  settings: Record<string, string> | undefined;
  userEmail: string | undefined;
  queryClient: QueryClient;
};

function buildDefaultClinicState() {
  return {
    clinicName: '',
    clinicIdentifier: '',
    clinicLogoUrl: '',
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
  };
}

export function useAjustesClinic({ settings, userEmail, queryClient }: Params) {
  const [previewSeed] = useState(() => new Date());
  const [testEmail, setTestEmail] = useState('');
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
  const [systemConfig, setSystemConfig] = useState({ sessionInactivityTimeoutMinutes: '15' });
  const [clinic, setClinic] = useState(buildDefaultClinicState);

  useEffect(() => {
    if (!settings) return;

    setSystemConfig({
      sessionInactivityTimeoutMinutes: settings['session.inactivityTimeoutMinutes'] || '15',
    });
    setClinic({
      clinicName: settings['clinic.name'] || '',
      clinicIdentifier: settings['clinic.identifier'] || '',
      clinicLogoUrl: settings['clinic.logoUrl'] || '',
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
  }, [settings]);

  useEffect(() => {
    if (!testEmail && userEmail) setTestEmail(userEmail);
  }, [testEmail, userEmail]);

  const previewBaseUrl = useMemo(() => {
    const configured = clinic.appPublicUrl.trim().replace(/\/+$/, '');
    if (configured) return configured;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:5555';
  }, [clinic.appPublicUrl]);

  const currentPresetId = useMemo(
    () => INVITATION_TEMPLATE_PRESETS.find((preset) => preset.html === clinic.invitationTemplateHtml)?.id || null,
    [clinic.invitationTemplateHtml],
  );

  const previewExpirationLabel = useMemo(
    () =>
      new Date(previewSeed.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString('es-CL', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [previewSeed],
  );

  const previewYear = useMemo(() => String(previewSeed.getFullYear()), [previewSeed]);
  const previewLogoUrl = clinic.clinicLogoUrl || `${previewBaseUrl}/anamneo-logo.svg`;

  const invitationTemplatePreview = useMemo(
    () =>
      renderInvitationTemplatePreview(clinic.invitationTemplateHtml, {
        clinicName: clinic.clinicName || 'Anamneo',
        recipientEmail: 'equipo@ejemplo.cl',
        inviteUrl: `${previewBaseUrl}/register?token=demo-token-123`,
        roleLabel: 'medico',
        expirationLabel: previewExpirationLabel,
        assignedMedicoName: 'Dra. Elena Rojas',
        assignedMedicoSection:
          '<p style="margin:0 0 12px; color:#475569;">Medico asignado: <strong>Dra. Elena Rojas</strong></p>',
        logoUrl: previewLogoUrl,
        year: previewYear,
      }),
    [clinic.clinicName, clinic.invitationTemplateHtml, previewBaseUrl, previewExpirationLabel, previewLogoUrl, previewYear],
  );

  const invitationSubjectPreview = useMemo(
    () =>
      renderInvitationTextTemplate(clinic.invitationSubject, {
        clinicName: clinic.clinicName || 'Anamneo',
        recipientEmail: testEmail || userEmail || 'equipo@ejemplo.cl',
        inviteUrl: `${previewBaseUrl}/register?token=demo-token-123`,
        roleLabel: 'medico',
        expirationLabel: previewExpirationLabel,
        assignedMedicoName: 'Dra. Elena Rojas',
        assignedMedicoSection: 'Dra. Elena Rojas',
        logoUrl: previewLogoUrl,
        year: previewYear,
      }),
    [clinic.clinicName, clinic.invitationSubject, previewBaseUrl, previewExpirationLabel, previewLogoUrl, previewYear, testEmail, userEmail],
  );

  const buildSettingsPayload = () => {
    const payload: Record<string, string | boolean | number> = {
      clinicName: clinic.clinicName,
      clinicIdentifier: clinic.clinicIdentifier,
      clinicLogoUrl: clinic.clinicLogoUrl,
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
    const inactivityTimeoutMinutes = Number.parseInt(systemConfig.sessionInactivityTimeoutMinutes, 10);
    if (Number.isFinite(inactivityTimeoutMinutes)) payload.sessionInactivityTimeoutMinutes = inactivityTimeoutMinutes;
    if (clinic.smtpPassword.trim().length > 0) payload.smtpPassword = clinic.smtpPassword;
    return payload;
  };

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
      return response.data as { sent: boolean; reason: string | null; subject: string | null };
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

  return {
    clinic,
    setClinic,
    systemConfig,
    setSystemConfig,
    smtpPasswordConfigured,
    clinicMutation,
    testEmail,
    setTestEmail,
    testInvitationMutation,
    currentPresetId,
    invitationTemplatePreview,
    invitationSubjectPreview,
    previewBaseUrl,
  };
}
