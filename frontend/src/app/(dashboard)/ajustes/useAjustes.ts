import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
import { api } from '@/lib/api';
import { useAuthLogout, useAuthSetUser, useAuthUser } from '@/stores/auth-store';
import {
  profileSchema,
  passwordSchema,
  type ProfileForm,
  type PasswordForm,
  type AjustesTab,
} from './ajustes.constants';
import { useAjustesClinic } from './useAjustesClinic';

export function useAjustes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const setUser = useAuthSetUser();
  const logout = useAuthLogout();
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

  const clinicSettings = useAjustesClinic({ settings, userEmail: user?.email, queryClient });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/profile', data),
    onSuccess: (res) => {
      const updated = res.data;
      setUser({ ...user!, nombre: updated.nombre, email: updated.email });
      notify.success('Perfil actualizado');
    },
    onError: () => notify.error('Error al actualizar perfil'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      notify.success('Contraseña actualizada');
      passwordForm.reset();
      queryClient.clear();
      logout({ clearLocalState: true });
      router.replace('/login');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Error al cambiar contraseña';
      notify.error(msg);
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
    ...clinicSettings,

  };
}

export type AjustesHook = ReturnType<typeof useAjustes>;
