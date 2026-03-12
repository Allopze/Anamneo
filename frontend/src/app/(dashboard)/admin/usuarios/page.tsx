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
  const { isAdmin } = useAuthStore();

  const [createForm, setCreateForm] = useState({
    nombre: '',
    email: '',
    password: '',
    role: 'MEDICO' as Role,
    medicoId: '' as string,
  });

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
  const getCreateErrors = useCallback(() => {
    const errors: string[] = [];
    if (createForm.nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
    if (!isValidEmail(createForm.email)) errors.push('Email inválido');
    if (createForm.password.length < 8) errors.push('Contraseña debe tener al menos 8 caracteres');
    return errors;
  }, [createForm]);
  const createErrors = getCreateErrors();

  const getEditErrors = useCallback(() => {
    const errors: string[] = [];
    if (editForm.nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
    if (!isValidEmail(editForm.email)) errors.push('Email inválido');
    if (editForm.password && editForm.password.length < 8) errors.push('Contraseña debe tener al menos 8 caracteres');
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

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nombre: createForm.nombre,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
      };
      if (createForm.role === 'ASISTENTE') {
        payload.medicoId = createForm.medicoId || undefined;
      }
      const response = await api.post('/users', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Usuario creado');
      setCreateForm({ nombre: '', email: '', password: '', role: 'MEDICO', medicoId: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
          <p className="text-slate-600">Crea médicos/asistentes y asigna asistentes a un médico</p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      {/* Create */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiPlus className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-slate-900">Crear usuario</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600">Nombre</label>
            <input
              className="form-input"
              value={createForm.nombre}
              onChange={(e) => setCreateForm((p) => ({ ...p, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
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
            onClick={() => createUserMutation.mutate()}
            disabled={createUserMutation.isPending || createErrors.length > 0}
          >
            <FiUsers className="w-4 h-4" />
            Crear
          </button>
          {createErrors.length > 0 && createForm.nombre.length + createForm.email.length + createForm.password.length > 0 && (
            <span className="text-xs text-red-500">{createErrors[0]}</span>
          )}
        </div>
      </div>

      {/* Edit */}
      {editingUser && (
        <div className="card mb-6 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FiEdit2 className="w-4 h-4 text-primary-600" />
              <h2 className="font-semibold text-slate-900">Editar usuario</h2>
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
                />
                Usuario activo
              </label>
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

      {/* List */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4">Usuarios</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded" />
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 truncate">{u.nombre}</span>
                    {u.isAdmin && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                        Admin
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {u.role === 'MEDICO' ? 'Médico' : 'Asistente'}
                    </span>
                    <span
                      className={
                        'text-xs px-2 py-0.5 rounded-full ' +
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
                        resetPasswordMutation.mutate({
                          userId: u.id,
                          temporaryPassword,
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
                    disabled={toggleActiveMutation.isPending}
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-slate-500">No hay usuarios</div>
        )}
      </div>
    </div>
  );
}
