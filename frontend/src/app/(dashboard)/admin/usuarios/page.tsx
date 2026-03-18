'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiPlus, FiUsers, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';

type Role = 'MEDICO' | 'ASISTENTE';

interface UserInvitationResponse {
  id: string;
  email: string;
  role: Role;
  medicoId?: string | null;
  expiresAt: string;
  token: string;
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
  const [createdInvitationUrl, setCreatedInvitationUrl] = useState<string | null>(null);

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
      const inviteUrl = `${window.location.origin}/register?token=${invitation.token}`;
      setCreatedInvitationUrl(inviteUrl);
      setCreateForm({ email: '', role: 'MEDICO', medicoId: '' });

      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success('Invitación creada y copiada al portapapeles');
      } catch {
        toast.success('Invitación creada');
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
    setCreatedInvitationUrl(null);
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
          <FiPlus className="w-4 h-4 text-primary-600" />
          <h2 className="panel-title">Crear invitación</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          El enlace permite que la persona complete su registro y defina su propia contraseña.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Rol</label>
            <select
              className="form-input"
              value={createForm.role}
              onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as Role }))}
            >
              <option value="MEDICO">Médico</option>
              <option value="ASISTENTE">Asistente</option>
            </select>
          </div>

          {createForm.role === 'ASISTENTE' && (
            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">Asignar a médico</label>
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
            <span className="text-xs text-red-500">{createErrors[0]}</span>
          )}
        </div>

        {createdInvitationUrl && (
          <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4">
            <p className="text-sm font-medium text-slate-900">Enlace de invitación</p>
            <p className="mt-2 break-all text-sm text-slate-700">{createdInvitationUrl}</p>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Asignación de asistentes</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assistantGroups.map(({ medico, assistants }) => (
            <div key={medico.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-slate-900">{medico.nombre}</h3>
                  <p className="text-sm text-slate-500">{medico.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    onClick={() => startEdit(assistant)}
                  >
                    <div className="font-medium text-slate-900">{assistant.nombre}</div>
                    <div className="text-sm text-slate-500">{assistant.email}</div>
                  </button>
                )) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
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
        <div className="card mb-6 border-primary-200">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <FiEdit2 className="w-4 h-4 text-primary-600" />
              <h2 className="panel-title">Editar usuario</h2>
            </div>
            <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">Nombre</label>
              <input
                className="form-input"
                value={editForm.nombre}
                onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Email</label>
              <input
                className="form-input"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Nueva contraseña (opcional)</label>
              <input
                type="password"
                className="form-input"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Rol</label>
              <select
                className="form-input"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as Role }))}
              >
                <option value="MEDICO">Médico</option>
                <option value="ASISTENTE">Asistente</option>
              </select>
            </div>

            {editForm.role === 'ASISTENTE' && (
              <div className="md:col-span-2">
                <label className="text-sm text-slate-600">Asignar a médico</label>
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
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.checked }))}
                  disabled={editingUser.isAdmin && editingUser.active && activeAdminCount === 1}
                />
                Usuario activo
              </label>
              {editingUser.isAdmin && editingUser.active && activeAdminCount === 1 && (
                <p className="mt-2 text-xs text-amber-700">
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
              <span className="text-xs text-red-500">{editErrors[0]}</span>
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
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="group list-row flex-col sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 truncate">{u.nombre}</span>
                    {u.isAdmin && (
                      <span className="list-chip bg-primary-100 text-primary-700">
                        Admin
                      </span>
                    )}
                    <span className="list-chip bg-slate-100 text-slate-700">
                      {u.role === 'MEDICO' ? 'Médico' : 'Asistente'}
                    </span>
                    <span
                      className={
                        'list-chip ' +
                        (u.active ? 'bg-clinical-100 text-clinical-700' : 'bg-slate-100 text-slate-500')
                      }
                    >
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 truncate">{u.email}</div>
                  {u.role === 'ASISTENTE' && u.medicoId && (
                    <div className="text-xs text-slate-400">Asignado a médico: {users?.find(m => m.id === u.medicoId)?.nombre || u.medicoId}</div>
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
                  <p className="text-xs text-amber-700">
                    Último administrador activo.
                  </p>
                )}
                {user?.id === u.id && (
                  <p className="text-xs text-slate-400">Sesión actual</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiUsers className="h-10 w-10 text-primary-400" />
            </div>
            <h3 className="empty-state-title">Sin usuarios cargados</h3>
            <p className="empty-state-description">No hay usuarios registrados todavía en esta instancia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
