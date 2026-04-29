import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  getDefaultInvitationTemplateHtml,
  getDefaultInvitationSubjectTemplate,
  INVITATION_TEMPLATE_PRESETS,
  renderInvitationTextTemplate,
  renderInvitationTemplatePreview,
} from '@/lib/invitation-email-templates';
import { useAuthStore } from '@/stores/auth-store';
import {
  profileSchema,
  passwordSchema,
  type ProfileForm,
  type PasswordForm,
  type AjustesTab,
} from './ajustes.constants';

export function useAjustes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = !!user?.isAdmin;

  const validTabs = useMemo(
    () =>
      isAdmin
        ? (['perfil', 'centro', 'correo', 'sistema'] as const)
        : (['perfil'] as const),
    [isAdmin],
  );
  const tabFromUrl = searchParams.get('tab') as AjustesTab | null;
  const initialTab =
    tabFromUrl && (validTabs as readonly string[]).includes(tabFromUrl) ? tabFromUrl : 'perfil';

  const [activeTab, setActiveTabState] = useState<AjustesTab>(initialTab);

  const setActiveTab = useCallback(
    (tab: AjustesTab) => {
      setActiveTabState(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.push(`/ajustes?${params.toString()}`);
    },
    [searchParams, router],
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab') as AjustesTab | null;
    const resolved =
      tabParam && (validTabs as readonly string[]).includes(tabParam) ? tabParam : 'perfil';
    setActiveTabState(resolved);
  }, [searchParams, validTabs]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const tabs = validTabs;
      const currentIndex = (tabs as readonly string[]).indexOf(activeTab);
      let nextIndex = currentIndex;
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      const nextTab = tabs[nextIndex] as typeof activeTab;
      setActiveTab(nextTab);
      document.getElementById(`tab-${nextTab}`)?.focus();
    },
    [activeTab, setActiveTab, validTabs],
  );

  // State
  const [showPassword, setShowPassword] = useState(false);
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
  const [previewSeed] = useState(() => new Date());
  const [testEmail, setTestEmail] = useState('');
  const [systemConfig, setSystemConfig] = useState({
    sessionInactivityTimeoutMinutes: '15',
  });
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

  // Forms
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nombre: user?.nombre ?? '', email: user?.email ?? '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Queries
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data as Record<string, string>,
    enabled: isAdmin,
  });

  // Effects
  useEffect(() => {
    if (settings) {
      setSystemConfig({
        sessionInactivityTimeoutMinutes: settings['session.inactivityTimeoutMinutes'] || '15',
      });
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
        invitationSubject:
          settings['email.invitationSubject'] || getDefaultInvitationSubjectTemplate(),
        invitationTemplateHtml:
          settings['email.invitationTemplateHtml'] || getDefaultInvitationTemplateHtml(),
      });
      setSmtpPasswordConfigured(settings['smtp.passwordConfigured'] === 'true');
    }
  }, [settings]);

  useEffect(() => {
    if (!testEmail && user?.email) setTestEmail(user.email);
  }, [testEmail, user?.email]);

  // Computed
  const previewBaseUrl = useMemo(() => {
    const configured = clinic.appPublicUrl.trim().replace(/\/+$/, '');
    if (configured) return configured;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:5556';
  }, [clinic.appPublicUrl]);

  const currentPresetId = useMemo(
    () => INVITATION_TEMPLATE_PRESETS.find((p) => p.html === clinic.invitationTemplateHtml)?.id || null,
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
        logoUrl: `${previewBaseUrl}/anamneo-logo.svg`,
        year: previewYear,
      }),
    [clinic.clinicName, clinic.invitationTemplateHtml, previewBaseUrl, previewExpirationLabel, previewYear],
  );

  const invitationSubjectPreview = useMemo(
    () =>
      renderInvitationTextTemplate(clinic.invitationSubject, {
        clinicName: clinic.clinicName || 'Anamneo',
        recipientEmail: testEmail || user?.email || 'equipo@ejemplo.cl',
        inviteUrl: `${previewBaseUrl}/register?token=demo-token-123`,
        roleLabel: 'medico',
        expirationLabel: previewExpirationLabel,
        assignedMedicoName: 'Dra. Elena Rojas',
        assignedMedicoSection: 'Dra. Elena Rojas',
        logoUrl: `${previewBaseUrl}/anamneo-logo.svg`,
        year: previewYear,
      }),
    [clinic.clinicName, clinic.invitationSubject, previewBaseUrl, previewExpirationLabel, previewYear, testEmail, user?.email],
  );

  // Mutations
  const buildSettingsPayload = () => {
    const payload: Record<string, string | boolean | number> = {
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
    const inactivityTimeoutMinutes = Number.parseInt(systemConfig.sessionInactivityTimeoutMinutes, 10);
    if (Number.isFinite(inactivityTimeoutMinutes)) {
      payload.sessionInactivityTimeoutMinutes = inactivityTimeoutMinutes;
    }
    if (clinic.smtpPassword.trim().length > 0) payload.smtpPassword = clinic.smtpPassword;
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
      passwordForm.reset();
      queryClient.clear();
      logout({ clearLocalState: true });
      router.replace('/login');
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
    user,
    isAdmin,
    activeTab,
    setActiveTab,
    handleTabKeyDown,
    validTabs,

    // Profile
    profileForm,
    profileMutation,
    showPassword,
    setShowPassword,
    passwordForm,
    passwordMutation,

    // Clinic & SMTP
    clinic,
    setClinic,
    systemConfig,
    setSystemConfig,
    smtpPasswordConfigured,
    clinicMutation,
    testEmail,
    setTestEmail,
    testInvitationMutation,

    // Email template
    currentPresetId,
    invitationTemplatePreview,
    invitationSubjectPreview,
    previewBaseUrl,
  };
}

export type AjustesHook = ReturnType<typeof useAjustes>;
