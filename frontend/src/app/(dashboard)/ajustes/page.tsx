'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
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
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Debe contener mayúscula, minúscula y número'),
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
  const [showPassword, setShowPassword] = useState(false);
  const [clinic, setClinic] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '', clinicEmail: '' });

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
  });

  useEffect(() => {
    if (settings) {
      setClinic({
        clinicName: settings['clinic.name'] || '',
        clinicAddress: settings['clinic.address'] || '',
        clinicPhone: settings['clinic.phone'] || '',
        clinicEmail: settings['clinic.email'] || '',
      });
    }
  }, [settings]);

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
    mutationFn: () => api.put('/settings', clinic),
    onSuccess: () => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error('Error al guardar configuración'),
  });

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ajustes</h1>

      {/* Profile section */}
      <div className="card mb-6">
        <h2 className="font-medium text-slate-900 mb-4">Datos personales</h2>
        <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              {...registerProfile('nombre')}
              className="input w-full"
            />
            {profileErrors.nombre && (
              <p className="text-red-500 text-xs mt-1">{profileErrors.nombre.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...registerProfile('email')}
              className="input w-full"
            />
            {profileErrors.email && (
              <p className="text-red-500 text-xs mt-1">{profileErrors.email.message}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
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

      {/* Password section */}
      <div className="card mb-6">
        <h2 className="font-medium text-slate-900 mb-4">Cambiar contraseña</h2>
        <form
          onSubmit={handlePassword((d) => passwordMutation.mutate(d))}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-slate-700 mb-1"
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
              <p className="text-red-500 text-xs mt-1">
                {passwordErrors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-slate-700 mb-1"
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
              <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 mb-1"
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
              <p className="text-red-500 text-xs mt-1">
                {passwordErrors.confirmPassword.message}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
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

      {/* Admin: Clinic Settings */}
      {user?.isAdmin && (
        <div className="card mb-6 border-amber-200">
          <h2 className="font-medium text-slate-900 mb-4">Datos del centro médico</h2>
          <p className="text-sm text-slate-500 mb-4">
            Esta información se usa en fichas impresas y exportaciones.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del centro</label>
              <input
                type="text"
                className="input w-full"
                value={clinic.clinicName}
                onChange={(e) => setClinic(c => ({ ...c, clinicName: e.target.value }))}
                placeholder="Ej: Centro Médico San Pablo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <input
                type="text"
                className="input w-full"
                value={clinic.clinicAddress}
                onChange={(e) => setClinic(c => ({ ...c, clinicAddress: e.target.value }))}
                placeholder="Ej: Av. Providencia 1234, Santiago"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  className="input w-full"
                  value={clinic.clinicPhone}
                  onChange={(e) => setClinic(c => ({ ...c, clinicPhone: e.target.value }))}
                  placeholder="+56 2 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
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
              {clinicMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      )}

      {/* System info */}
      <div className="card">
        <h2 className="font-medium text-slate-900 mb-4">Información del sistema</h2>
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
