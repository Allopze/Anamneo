import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { AjustesHook } from './useAjustes';

type Props = Pick<
  AjustesHook,
  'profileForm' | 'profileMutation' | 'showPassword' | 'setShowPassword' | 'passwordForm' | 'passwordMutation'
> & {
  userRole: string | undefined;
};

export default function ProfileSecurityTab({
  profileForm,
  profileMutation,
  showPassword,
  setShowPassword,
  passwordForm,
  passwordMutation,
  userRole,
}: Props) {
  const {
    register: registerProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = profileForm;

  const {
    register: registerPassword,
    handleSubmit: handlePassword,
    formState: { errors: passwordErrors },
  } = passwordForm;

  return (
    <div role="tabpanel" id="tabpanel-perfil" aria-labelledby="tab-perfil">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Datos personales</h2>
          </div>
          <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-ink-secondary mb-1">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                {...registerProfile('nombre')}
                className="input w-full"
                aria-describedby={profileErrors.nombre ? 'nombre-error' : undefined}
                aria-invalid={!!profileErrors.nombre}
              />
              {profileErrors.nombre && (
                <p id="nombre-error" className="text-status-red text-xs mt-1" role="alert">
                  {profileErrors.nombre.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...registerProfile('email')}
                className="input w-full"
                aria-describedby={profileErrors.email ? 'email-error' : undefined}
                aria-invalid={!!profileErrors.email}
              />
              {profileErrors.email && (
                <p id="email-error" className="text-status-red text-xs mt-1" role="alert">
                  {profileErrors.email.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="inline-flex items-center rounded-pill bg-surface-inset px-3 py-1 text-xs font-bold text-ink-secondary tracking-wide uppercase">
                {userRole}
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

        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Cambiar contraseña</h2>
          </div>
          <form onSubmit={handlePassword((d) => passwordMutation.mutate(d))} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-ink-secondary mb-1">
                Contraseña actual
              </label>
              <input
                id="currentPassword"
                type={showPassword ? 'text' : 'password'}
                {...registerPassword('currentPassword')}
                className="input w-full"
                aria-describedby={passwordErrors.currentPassword ? 'currentPassword-error' : undefined}
                aria-invalid={!!passwordErrors.currentPassword}
              />
              {passwordErrors.currentPassword && (
                <p id="currentPassword-error" className="text-status-red text-xs mt-1" role="alert">
                  {passwordErrors.currentPassword.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-ink-secondary mb-1">
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                {...registerPassword('newPassword')}
                className="input w-full"
                aria-describedby={passwordErrors.newPassword ? 'newPassword-error' : undefined}
                aria-invalid={!!passwordErrors.newPassword}
              />
              {passwordErrors.newPassword && (
                <p id="newPassword-error" className="text-status-red text-xs mt-1" role="alert">
                  {passwordErrors.newPassword.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-secondary mb-1">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                {...registerPassword('confirmPassword')}
                className="input w-full"
                aria-describedby={passwordErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                aria-invalid={!!passwordErrors.confirmPassword}
              />
              {passwordErrors.confirmPassword && (
                <p id="confirmPassword-error" className="text-status-red text-xs mt-1" role="alert">
                  {passwordErrors.confirmPassword.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
              <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} />
              Mostrar contraseñas
            </label>
            <button type="submit" disabled={passwordMutation.isPending} className="btn btn-primary">
              {passwordMutation.isPending ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>

      <TwoFactorSection />
    </div>
  );
}

function TwoFactorSection() {
  const { user, setUser } = useAuthStore();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState('');

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/2fa/setup');
      return res.data as { qrCodeDataUrl: string; secret: string };
    },
    onSuccess: (data) => {
      setQrCodeDataUrl(data.qrCodeDataUrl ?? null);
      setError('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const enableMutation = useMutation({
    mutationFn: async (code: string) => {
      await api.post('/auth/2fa/enable', { code });
    },
    onSuccess: () => {
      toast.success('Autenticación de dos factores activada');
      if (user) setUser({ ...user, totpEnabled: true });
      setQrCodeDataUrl(null);
      setTotpCode('');
      setError('');
    },
    onError: () => setError('Código incorrecto. Verifica e intenta de nuevo.'),
  });

  const disableMutation = useMutation({
    mutationFn: async (password: string) => {
      await api.post('/auth/2fa/disable', { password });
    },
    onSuccess: () => {
      toast.success('Autenticación de dos factores desactivada');
      if (user) setUser({ ...user, totpEnabled: false });
      setDisablePassword('');
      setError('');
    },
    onError: () => setError('Contraseña incorrecta.'),
  });

  const isEnabled = !!user?.totpEnabled;

  return (
    <div className="card mb-6">
      <div className="panel-header">
        <h2 className="panel-title">Autenticación de dos factores (2FA)</h2>
        {isEnabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-green/20 px-2.5 py-1 text-xs font-semibold text-status-green-text">
            Activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
            Inactiva
          </span>
        )}
      </div>

      <p className="text-sm text-ink-muted mb-4">
        La verificación en dos pasos agrega una capa extra de seguridad. Al activarla, necesitarás un código de tu
        aplicación autenticadora cada vez que inicies sesión.
      </p>

      {error && (
        <div className="mb-4 rounded-card border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red-text">
          {error}
        </div>
      )}

      {!isEnabled && !qrCodeDataUrl && (
        <button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} className="btn btn-primary">
          {setupMutation.isPending ? 'Configurando...' : 'Configurar 2FA'}
        </button>
      )}

      {!isEnabled && qrCodeDataUrl && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-card border border-surface-muted/40 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="Código QR para 2FA" width={180} height={180} />
            </div>
            <div className="flex-1 text-sm text-ink-secondary">
              <p className="font-medium text-ink mb-2">Escanea este código QR</p>
              <p>
                Abre Google Authenticator, Authy u otra app compatible y escanea el código. Luego ingresa el código de 6
                dígitos para confirmar la activación.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="totp-enable-code" className="block text-sm font-medium text-ink-secondary mb-1">
              Código de verificación
            </label>
            <input
              id="totp-enable-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="000000"
              className="input w-48 text-center text-lg tracking-[0.2em]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => enableMutation.mutate(totpCode)}
              disabled={totpCode.length !== 6 || enableMutation.isPending}
              className="btn btn-primary"
            >
              {enableMutation.isPending ? 'Activando...' : 'Activar 2FA'}
            </button>
            <button
              onClick={() => {
                setQrCodeDataUrl(null);
                setTotpCode('');
                setError('');
              }}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isEnabled && (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Para desactivar la verificación en dos pasos, ingresa tu contraseña actual.
          </p>
          <div>
            <label htmlFor="disable-2fa-password" className="block text-sm font-medium text-ink-secondary mb-1">
              Contraseña
            </label>
            <input
              id="disable-2fa-password"
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => {
                setDisablePassword(e.target.value);
                setError('');
              }}
              placeholder="Tu contraseña actual"
              className="input w-full max-w-sm"
            />
          </div>
          <button
            onClick={() => disableMutation.mutate(disablePassword)}
            disabled={!disablePassword.trim() || disableMutation.isPending}
            className="btn btn-secondary text-status-red-text"
          >
            {disableMutation.isPending ? 'Desactivando...' : 'Desactivar 2FA'}
          </button>
        </div>
      )}
    </div>
  );
}
