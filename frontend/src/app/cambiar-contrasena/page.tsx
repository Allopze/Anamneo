'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthHasHydrated, useAuthLogout, useAuthUser } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import toast from 'react-hot-toast';

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const user = useAuthUser();
  const logout = useAuthLogout();
  const hasHydrated = useAuthHasHydrated();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasHydrated || user?.mustChangePassword) {
      return;
    }

    router.replace('/');
  }, [hasHydrated, router, user?.mustChangePassword]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-frame border-t-transparent" />
      </div>
    );
  }

  if (!user?.mustChangePassword) {
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Contraseña actualizada. Inicie sesión nuevamente.');
      logout({ clearLocalState: true });
      router.replace('/login');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="card max-w-md w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Cambio de contraseña obligatorio</h1>
          <p className="text-ink-secondary mt-1">
            Su contraseña fue restablecida por un administrador. Debe crear una nueva contraseña para continuar.
          </p>
        </div>

        {error && <ErrorAlert message={error} />}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="form-label">Contraseña temporal actual</label>
            <input
              id="currentPassword"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="form-label">Nueva contraseña</label>
            <input
              id="newPassword"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="form-label">Confirmar nueva contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
            {isLoading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
