import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthSetUser, useAuthUser } from '@/stores/auth-store';
import TwoFactorRecoveryCodesPanel from './TwoFactorRecoveryCodesPanel';

function getTwoFactorErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error).trim();
  return message.length > 0 ? message : fallback;
}

export default function TwoFactorSection() {
  const user = useAuthUser();
  const setUser = useAuthSetUser();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
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
      const res = await api.post('/auth/2fa/enable', { code });
      return res.data as { message: string; recoveryCodes?: string[] };
    },
    onSuccess: (data) => {
      toast.success('Autenticación de dos factores activada');
      if (user) setUser({ ...user, totpEnabled: true });
      setQrCodeDataUrl(null);
      setTotpCode('');
      setRecoveryCodes(data.recoveryCodes ?? []);
      setError('');
    },
    onError: (err) => setError(getTwoFactorErrorMessage(err, 'No se pudo activar 2FA. Intenta nuevamente.')),
  });

  const disableMutation = useMutation({
    mutationFn: async (password: string) => {
      await api.post('/auth/2fa/disable', { password });
    },
    onSuccess: () => {
      toast.success('Autenticación de dos factores desactivada');
      if (user) setUser({ ...user, totpEnabled: false });
      setDisablePassword('');
      setRecoveryPassword('');
      setRecoveryCodes([]);
      setError('');
    },
    onError: (err) => setError(getTwoFactorErrorMessage(err, 'No se pudo desactivar 2FA. Intenta nuevamente.')),
  });

  const regenerateCodesMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await api.post('/auth/2fa/recovery-codes/regenerate', { password });
      return res.data as { message: string; recoveryCodes?: string[] };
    },
    onSuccess: (data) => {
      toast.success('Códigos de recuperación actualizados');
      setRecoveryCodes(data.recoveryCodes ?? []);
      setRecoveryPassword('');
      setError('');
    },
    onError: (err) => setError(getTwoFactorErrorMessage(err, 'No se pudieron regenerar los códigos de recuperación.')),
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
          {recoveryCodes.length > 0 ? (
            <TwoFactorRecoveryCodesPanel codes={recoveryCodes} onDismiss={() => setRecoveryCodes([])} />
          ) : null}

          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated/60 p-4">
            <p className="text-sm font-medium text-ink-primary">Códigos de recuperación de un solo uso</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Si pierdes el acceso a tu app autenticadora, podrás entrar con uno de estos códigos. Regenera un set nuevo
              si no sabes dónde quedaron guardados.
            </p>

            {recoveryCodes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                Los códigos sólo se vuelven a mostrar al activar 2FA o al regenerarlos.
              </p>
            ) : null}

            <div className="mt-4">
              <label htmlFor="recovery-2fa-password" className="block text-sm font-medium text-ink-secondary mb-1">
                Contraseña actual para regenerar códigos
              </label>
              <input
                id="recovery-2fa-password"
                type="password"
                autoComplete="current-password"
                value={recoveryPassword}
                onChange={(e) => {
                  setRecoveryPassword(e.target.value);
                  setError('');
                }}
                placeholder="Tu contraseña actual"
                className="input w-full max-w-sm"
              />
            </div>

            <button
              onClick={() => regenerateCodesMutation.mutate(recoveryPassword)}
              disabled={!recoveryPassword.trim() || regenerateCodesMutation.isPending}
              className="btn btn-secondary mt-4"
            >
              {regenerateCodesMutation.isPending ? 'Regenerando...' : 'Generar nuevos códigos'}
            </button>
          </div>

          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated/60 p-4">
            <p className="text-sm text-ink-secondary">
              Para desactivar la verificación en dos pasos, ingresa tu contraseña actual.
            </p>
            <div className="mt-4">
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
              className="btn btn-secondary mt-4 text-status-red-text"
            >
              {disableMutation.isPending ? 'Desactivando...' : 'Desactivar 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
