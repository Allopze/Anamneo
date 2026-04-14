import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  type Role,
  type InvitationStatus,
  type AdminUserRow,
  type AdminInvitationRow,
  type UserInvitationResponse,
  type CreatedInvitationState,
  isValidEmail,
  getPasswordError,
  getBrowserOrigin,
} from './usuarios.constants';

export function useUsuarios() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuthStore();

  const [createForm, setCreateForm] = useState({
    email: '',
    role: 'MEDICO' as Role,
    medicoId: '' as string,
  });
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitationState | null>(null);

  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    email: '',
    password: '',
    role: 'MEDICO' as Role,
    medicoId: '' as string,
    active: true,
  });

  const getCreateErrors = useCallback(() => {
    const errors: string[] = [];
    if (!isValidEmail(createForm.email)) errors.push('Email inválido');
    if (createForm.role === 'ASISTENTE' && !createForm.medicoId) {
      errors.push('Debe asignar el asistente a un médico');
    }

    return errors;
  }, [createForm]);
  const createErrors = getCreateErrors();

  const getEditErrors = useCallback(() => {
    const errors: string[] = [];
    if (editForm.nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
    if (!isValidEmail(editForm.email)) errors.push('Email inválido');

    const passwordError = getPasswordError(editForm.password, false);
    if (passwordError) errors.push(passwordError);

    return errors;
  }, [editForm]);
  const editErrors = getEditErrors();

  const generateTemporaryPassword = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const randomValues = new Uint32Array(12);
    window.crypto.getRandomValues(randomValues);
    let generated = '';
    for (let i = 0; i < randomValues.length; i += 1) {
      generated += chars.charAt(randomValues[i] % chars.length);
    }
    return `T${generated.slice(1, 11)}1`;
  }, []);

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/pacientes');
    }
  }, [isAdmin, router]);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data as AdminUserRow[];
    },
    enabled: isAdmin(),
  });

  const {
    data: invitations,
    isLoading: isLoadingInvitations,
    error: invitationsError,
  } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const response = await api.get('/users/invitations');
      return response.data as AdminInvitationRow[];
    },
    enabled: isAdmin(),
  });

  const medicos = useMemo(() => {
    return (users || []).filter((u) => u.role === 'MEDICO' && u.active);
  }, [users]);

  const activeAdminCount = useMemo(() => (
    (users || []).filter((candidate) => candidate.isAdmin && candidate.active).length
  ), [users]);

  const assistantGroups = useMemo(() => {
    return medicos.map((medico) => ({
      medico,
      assistants: (users || []).filter((candidate) => candidate.role === 'ASISTENTE' && candidate.medicoId === medico.id),
    }));
  }, [medicos, users]);

  const getInvitationStatus = useCallback((invitation: AdminInvitationRow): InvitationStatus => {
    if (invitation.acceptedAt) return 'ACEPTADA';
    if (invitation.revokedAt) return 'REVOCADA';
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) return 'EXPIRADA';
    return 'PENDIENTE';
  }, []);

  const createInvitationMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        email: createForm.email,
        role: createForm.role,
      };
      if (createForm.role === 'ASISTENTE') {
        payload.medicoId = createForm.medicoId || undefined;
      }
      const response = await api.post('/users/invitations', payload);
      return response.data as UserInvitationResponse;
    },
    onSuccess: async (invitation) => {
      const inviteUrl = invitation.inviteUrl || `${getBrowserOrigin()}/register?token=${invitation.token}`;
      setCreatedInvitation({
        email: invitation.email,
        inviteUrl,
        emailSent: invitation.emailSent,
        emailError: invitation.emailError,
      });
      setCreateForm({ email: '', role: 'MEDICO', medicoId: '' });
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });

      if (invitation.emailSent) {
        toast.success('Invitación enviada por correo');
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success('Invitación creada. Se copió el enlace manual');
      } catch {
        toast.success('Invitación creada. Comparte el enlace manualmente');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const payload: any = {
        nombre: editForm.nombre,
        email: editForm.email,
        role: editForm.role,
        active: editForm.active,
      };
      if (editForm.password?.trim()) payload.password = editForm.password;
      if (editForm.role === 'ASISTENTE') {
        payload.medicoId = editForm.medicoId || null;
      } else {
        payload.medicoId = null;
      }
      const response = await api.put(`/users/${editingUser.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Usuario actualizado');
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [toggleConfirmUser, setToggleConfirmUser] = useState<AdminUserRow | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: async (target: AdminUserRow) => {
      const response = await api.put(`/users/${target.id}`, {
        active: !target.active,
      });
      return response.data;
    },
    onSuccess: () => {
      setToggleConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => {
      setToggleConfirmUser(null);
      toast.error(getErrorMessage(err));
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await api.delete(`/users/invitations/${invitationId}`);
      return response.data as { id: string; revokedAt: string };
    },
    onSuccess: () => {
      toast.success('Invitación revocada');
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, temporaryPassword }: { userId: string; temporaryPassword: string }) => {
      const response = await api.post(`/users/${userId}/reset-password`, { temporaryPassword });
      return response.data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startEdit = (target: AdminUserRow) => {
    setEditingUser(target);
    setEditForm({
      nombre: target.nombre,
      email: target.email,
      password: '',
      role: target.role,
      medicoId: target.medicoId || '',
      active: target.active,
    });
  };

  const prefillAssistantForMedico = (medico: AdminUserRow) => {
    setCreateForm({
      email: '',
      role: 'ASISTENTE',
      medicoId: medico.id,
    });
    setCreatedInvitation(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    user,
    isAdmin,
    // Data
    users,
    invitations,
    medicos,
    activeAdminCount,
    assistantGroups,
    // Loading / errors
    isLoading,
    isLoadingInvitations,
    error,
    invitationsError,
    // Create invitation
    createForm,
    setCreateForm,
    createErrors,
    createdInvitation,
    createInvitationMutation,
    // Edit user
    editingUser,
    setEditingUser,
    editForm,
    setEditForm,
    editErrors,
    updateUserMutation,
    // Toggle active
    toggleConfirmUser,
    setToggleConfirmUser,
    toggleActiveMutation,
    // Other mutations
    revokeInvitationMutation,
    resetPasswordMutation,
    generateTemporaryPassword,
    // Helpers
    getInvitationStatus,
    startEdit,
    prefillAssistantForMedico,
  };
}
