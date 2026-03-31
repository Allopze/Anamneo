'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiPlus, FiUsers, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';

type Role = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

type InvitationStatus = 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA' | 'EXPIRADA';

const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  REVOCADA: 'Revocada',
  EXPIRADA: 'Expirada',
};

const INVITATION_STATUS_STYLES: Record<InvitationStatus, string> = {
  PENDIENTE: 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text',
  ACEPTADA: 'bg-status-green/20 text-status-green',
  REVOCADA: 'bg-surface-muted text-ink-secondary',
  EXPIRADA: 'border border-status-yellow/70 bg-status-yellow/40 text-accent-text',
};

function formatInvitationDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

interface UserInvitationResponse {
  id: string;
  email: string;
  role: Role;
  medicoId?: string | null;
  expiresAt: string;
  token: string;
  inviteUrl?: string | null;
  emailSent: boolean;
  emailError?: string | null;
}

interface CreatedInvitationState {
  email: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | null;
}

interface AdminInvitationRow {
  id: string;
  email: string;
  role: Role;
  medicoId?: string | null;
  invitedById: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  nombre: string;
  role: Role;
  active: boolean;
  isAdmin?: boolean;
  medicoId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsuariosPage() {
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

  // Validation helpers
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const getPasswordError = (password: string, required: boolean) => {
    const value = password;

    if (!required && value.trim().length === 0) return null;
    if (value.length < 8) return 'Contraseña debe tener al menos 8 caracteres';
    if (value.length > 72) return 'Contraseña no puede exceder 72 caracteres';
    if (/\s/.test(value)) return 'Contraseña no puede contener espacios';
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
      return 'Contraseña debe contener mayúscula, minúscula y número';
    }

    return null;
  };

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
      const inviteUrl = invitation.inviteUrl || `${window.location.origin}/register?token=${invitation.token}`;
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

  const toggleActiveMutation = useMutation({
    mutationFn: async (user: AdminUserRow) => {
      const response = await api.put(`/users/${user.id}`, {
        active: !user.active,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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

  const startEdit = (user: AdminUserRow) => {
    setEditingUser(user);
    setEditForm({
      nombre: user.nombre,
      email: user.email,
      password: '',
      role: user.role,
      medicoId: user.medicoId || '',
      active: user.active,
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

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Administración de usuarios</h1>
          <p className="page-header-description">Crea médicos y asistentes, y administra sus relaciones operativas.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      <div className="card mb-6">
        <div className="panel-header">
          <div className="flex items-center gap-2">
          <FiPlus className="w-4 h-4 text-accent-text" />
          <h2 className="panel-title">Crear invitación</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-ink-secondary">
          El enlace permite que la persona complete su registro y defina su propia contraseña.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-ink-secondary">Email</label>
            <input
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-ink-secondary">Rol</label>
            <select
              className="form-input"
              value={createForm.role}
              onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as Role }))}
            >
              <option value="MEDICO">Médico</option>
              <option value="ASISTENTE">Asistente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          {createForm.role === 'ASISTENTE' && (
            <div className="md:col-span-2">
              <label className="text-sm text-ink-secondary">Asignar a médico</label>
              <select
                className="form-input"
                value={createForm.medicoId}
                onChange={(e) => setCreateForm((p) => ({ ...p, medicoId: e.target.value }))}
              >
                <option value="">Selecciona un médico…</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => createInvitationMutation.mutate()}
            disabled={createInvitationMutation.isPending || createErrors.length > 0}
          >
            <FiUsers className="w-4 h-4" />
            Crear invitación
          </button>
          {createErrors.length > 0 && createForm.email.length > 0 && (
            <span className="text-xs text-status-red">{createErrors[0]}</span>
          )}
        </div>

        {createdInvitation && (
          <div className={`mt-4 rounded-xl border p-4 ${createdInvitation.emailSent ? 'border-status-green/30 bg-status-green/10' : 'border-accent/20 bg-accent/10'}`}>
            <p className="text-sm font-medium text-ink-primary">
              {createdInvitation.emailSent
                ? `Invitación enviada a ${createdInvitation.email}`
                : 'Enlace de invitación listo'}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {createdInvitation.emailSent
                ? 'El correo salió con la configuración SMTP actual. Conserva el enlace como respaldo.'
                : 'No se pudo enviar automáticamente por correo. Puedes compartir este enlace manualmente.'}
            </p>
            {createdInvitation.emailError && (
              <p className="mt-2 text-xs text-accent-text">{createdInvitation.emailError}</p>
            )}
            <p className="mt-2 break-all text-sm text-ink-secondary">{createdInvitation.inviteUrl}</p>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Invitaciones</h2>
        </div>

        <p className="mb-4 text-sm text-ink-secondary">
          Revisa el estado de cada invitación pendiente. Para reenviar un enlace, crea una nueva invitación para el mismo correo.
        </p>

        {invitationsError && (
          <div className="mb-4">
            <ErrorAlert message={getErrorMessage(invitationsError)} />
          </div>
        )}

        {isLoadingInvitations ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded" />
            ))}
          </div>
        ) : invitations && invitations.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {invitations.map((invitation) => {
              const status = getInvitationStatus(invitation);
              const assignedMedico = invitation.medicoId
                ? users?.find((candidate) => candidate.id === invitation.medicoId)
                : null;
              const canRevoke = status === 'PENDIENTE';

              return (
                <div key={invitation.id} className="group list-row flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-primary truncate">{invitation.email}</span>
                      <span className="list-chip bg-surface-muted text-ink-secondary">
                        {invitation.role === 'MEDICO' ? 'Médico' : invitation.role === 'ADMIN' ? 'Administrador' : 'Asistente'}
                      </span>
                      <span className={`list-chip ${INVITATION_STATUS_STYLES[status]}`}>
                        {INVITATION_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      Creada: {formatInvitationDate(invitation.createdAt)} · Expira: {formatInvitationDate(invitation.expiresAt)}
                    </div>
                    {assignedMedico && (
                      <div className="text-xs text-ink-muted mt-1">
                        Asignada a médico: {assignedMedico.nombre} ({assignedMedico.email})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canRevoke && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                      >
                        Revocar
                      </button>
                    )}
                    {status === 'REVOCADA' && (
                      <span className="text-xs text-ink-muted">Enlace invalidado</span>
                    )}
                    {status === 'ACEPTADA' && (
                      <span className="text-xs text-status-green">Cuenta creada</span>
                    )}
                    {status === 'EXPIRADA' && (
                      <span className="text-xs text-accent-text">Crear nueva invitación</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-surface-muted/30 px-4 py-6 text-sm text-ink-muted">
            No hay invitaciones emitidas todavía.
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Asignación de asistentes</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assistantGroups.map(({ medico, assistants }) => (
            <div key={medico.id} className="rounded-xl border border-surface-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-ink-primary">{medico.nombre}</h3>
                  <p className="text-sm text-ink-muted">{medico.email}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {assistants.length} asistente{assistants.length === 1 ? '' : 's'} asignado{assistants.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => prefillAssistantForMedico(medico)}
                >
                  Crear asistente
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {assistants.length > 0 ? assistants.map((assistant) => (
                  <button
                    key={assistant.id}
                    className="w-full rounded-lg border border-surface-muted/30 px-3 py-2 text-left hover:border-accent/60 hover:bg-accent/10 transition-colors"
                    onClick={() => startEdit(assistant)}
                  >
                    <div className="font-medium text-ink-primary">{assistant.nombre}</div>
                    <div className="text-sm text-ink-muted">{assistant.email}</div>
                  </button>
                )) : (
                  <div className="rounded-lg border border-dashed border-surface-muted/30 px-3 py-4 text-sm text-ink-muted">
                    Sin asistentes asignados.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit */}
      {editingUser && (
        <div className="card mb-6 border-accent/20">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <FiEdit2 className="w-4 h-4 text-accent-text" />
              <h2 className="panel-title">Editar usuario</h2>
            </div>
            <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-ink-secondary">Nombre</label>
              <input
                className="form-input"
                value={editForm.nombre}
                onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Email</label>
              <input
                className="form-input"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Nueva contraseña (opcional)</label>
              <input
                type="password"
                className="form-input"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Rol</label>
              <select
                className="form-input"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as Role }))}
              >
                <option value="MEDICO">Médico</option>
                <option value="ASISTENTE">Asistente</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            {editForm.role === 'ASISTENTE' && (
              <div className="md:col-span-2">
                <label className="text-sm text-ink-secondary">Asignar a médico</label>
                <select
                  className="form-input"
                  value={editForm.medicoId}
                  onChange={(e) => setEditForm((p) => ({ ...p, medicoId: e.target.value }))}
                >
                  <option value="">Selecciona un médico…</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.checked }))}
                  disabled={editingUser.isAdmin && editingUser.active && activeAdminCount === 1}
                />
                Usuario activo
              </label>
              {editingUser.isAdmin && editingUser.active && activeAdminCount === 1 && (
                <p className="mt-2 text-xs text-accent-text">
                  Este es el último administrador activo y no puede desactivarse.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={() => updateUserMutation.mutate()}
              disabled={updateUserMutation.isPending || editErrors.length > 0}
            >
              <FiCheck className="w-4 h-4" />
              Guardar cambios
            </button>
            {editErrors.length > 0 && (
              <span className="text-xs text-status-red">{editErrors[0]}</span>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="panel-header">
          <h2 className="panel-title">Usuarios</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded" />
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {users.map((u) => (
              <div key={u.id} className="group list-row flex-col sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink-primary truncate">{u.nombre}</span>
                    {u.isAdmin && (
                      <span className="list-chip border border-status-yellow/60 bg-status-yellow/30 text-accent-text">
                        Admin
                      </span>
                    )}
                    <span className="list-chip bg-surface-muted text-ink-secondary">
                      {u.role === 'MEDICO' ? 'Médico' : u.role === 'ADMIN' ? 'Administrador' : 'Asistente'}
                    </span>
                    <span
                      className={
                        'list-chip ' +
                        (u.active ? 'bg-status-green/20 text-status-green' : 'bg-surface-muted text-ink-muted')
                      }
                    >
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="text-sm text-ink-muted truncate">{u.email}</div>
                  {u.role === 'ASISTENTE' && u.medicoId && (
                    <div className="text-xs text-ink-muted">Asignado a médico: {users?.find(m => m.id === u.medicoId)?.nombre || u.medicoId}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary" onClick={() => startEdit(u)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (confirm(`¿Resetear la contraseña de ${u.nombre}?`)) {
                        const temporaryPassword = window.prompt(
                          `Ingresa una contraseña temporal para ${u.nombre}`,
                          generateTemporaryPassword(),
                        );
                        if (!temporaryPassword) {
                          return;
                        }

                        const temporaryPasswordError = getPasswordError(temporaryPassword.trim(), true);
                        if (temporaryPasswordError) {
                          toast.error(temporaryPasswordError);
                          return;
                        }

                        resetPasswordMutation.mutate({
                          userId: u.id,
                          temporaryPassword: temporaryPassword.trim(),
                        });
                      }
                    }}
                    disabled={resetPasswordMutation.isPending}
                  >
                    Reset pass
                  </button>
                  <button
                    className={u.active ? 'btn btn-danger' : 'btn btn-secondary'}
                    onClick={() => toggleActiveMutation.mutate(u)}
                    disabled={toggleActiveMutation.isPending || (u.isAdmin && u.active && activeAdminCount === 1)}
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
                {u.isAdmin && u.active && activeAdminCount === 1 && (
                  <p className="text-xs text-accent-text">
                    Último administrador activo.
                  </p>
                )}
                {user?.id === u.id && (
                  <p className="text-xs text-ink-muted">Sesión actual</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiUsers className="h-10 w-10 text-accent-text" />
            </div>
            <h3 className="empty-state-title">Sin usuarios cargados</h3>
            <p className="empty-state-description">No hay usuarios registrados todavía en esta instancia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
