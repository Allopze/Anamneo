'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthHasHydrated, useAuthLogout, useAuthUser } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import toast from 'react-hot-toast';

function CambiarContrasenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const logout = useAuthLogout();
  const hasHydrated = useAuthHasHydrated();

  const token = useMemo(() => searchParams?.get('token')?.trim() ?? null, [searchParams]);
  const isResetMode = !!token;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenState, setTokenState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    isResetMode ? 'checking' : 'idle',
  );
  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    if (!isResetMode) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/auth/forgot-password/${encodeURIComponent(token!)}`);
        if (cancelled) return;
        if (response.data?.valid) {
          setTokenState('valid');
          setRequires2FA(!!response.data?.requires2FA);
        } else {
          setTokenState('invalid');
        }
      } catch {
        if (cancelled) return;
        setTokenState('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [isResetMode, token]);

  useEffect(() => {
    if (isResetMode) return;
    if (!hasHydrated || user?.mustChangePassword) {
      return;
    }
    router.replace('/');
  }, [hasHydrated, router, user?.mustChangePassword, isResetMode]);

  if (!isResetMode && !hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-frame border-t-transparent" />
      </div>
    );
  }

  if (!isResetMode && !user?.mustChangePassword) {
    return null;
  }

  const onSubmitAuthed = async (e: React.FormEvent) => {
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

  const onSubmitReset = async (e: React.FormEvent) => {
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
    if (requires2FA && !totpCode.trim()) {
      setError('Ingresa tu código 2FA o un código de recuperación');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password/confirm', {
        token,
        newPassword,
        ...(requires2FA && totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
      });
      toast.success('Contraseña restablecida. Inicia sesión con la nueva contraseña.');
      router.replace('/login');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (isResetMode && tokenState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-frame border-t-transparent" />
      </div>
    );
  }

  if (isResetMode && tokenState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="card max-w-md w-full space-y-4">
          <h1 className="text-2xl font-bold text-ink-primary">Enlace no válido</h1>
          <p className="text-ink-secondary">
            El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo desde la pantalla de inicio de sesión.
          </p>
          <Link href="/forgot-password" className="btn btn-primary w-full text-center">
            Solicitar nuevo enlace
          </Link>
          <Link href="/login" className="auth-inline-link block text-center">Volver a inicio de sesión</Link>
        </div>
      </div>
    );
  }

  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="card max-w-md w-full space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Restablecer contraseña</h1>
            <p className="text-ink-secondary mt-1">
              Define una nueva contraseña para tu cuenta. Al confirmar, se cerrarán todas tus sesiones activas.
            </p>
          </div>

          {error && <ErrorAlert message={error} />}

          <form onSubmit={onSubmitReset} className="space-y-4">
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
                autoComplete="new-password"
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
                autoComplete="new-password"
              />
            </div>
            {requires2FA && (
              <div>
                <label htmlFor="totpCode" className="form-label">
                  Código 2FA o código de recuperación
                </label>
                <input
                  id="totpCode"
                  type="text"
                  inputMode="text"
                  className="form-input"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  required
                  maxLength={16}
                  autoComplete="one-time-code"
                />
                <p className="text-ink-muted text-sm mt-1">
                  Tu cuenta tiene autenticación de dos factores activa. Ingresa el código de tu app autenticadora
                  o uno de tus códigos de recuperación.
                </p>
              </div>
            )}
            <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? 'Restableciendo…' : 'Restablecer contraseña'}
            </button>
          </form>

          <p className="text-center text-ink-secondary text-sm">
            <Link href="/login" className="auth-inline-link">Volver a inicio de sesión</Link>
          </p>
        </div>
      </div>
    );
  }

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

        <form onSubmit={onSubmitAuthed} className="space-y-4">
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

export default function CambiarContrasenaPage() {
  return (
    <Suspense fallback={null}>
      <CambiarContrasenaContent />
    </Suspense>
  );
}
