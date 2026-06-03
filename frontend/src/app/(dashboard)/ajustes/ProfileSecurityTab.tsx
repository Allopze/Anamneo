import { useState } from 'react';
import { notify } from '@/lib/notify';
import { clearEncounterLocalStateForUser } from '@/lib/encounter-draft';
import { clearPendingSavesForUser } from '@/lib/offline-queue';
import { useAuthUser } from '@/stores/auth-store';
import { isSharedDeviceModeForced, usePrivacySettingsStore } from '@/stores/privacy-settings-store';
import type { AjustesHook } from './useAjustes';
import LegalDocumentsSection from './LegalDocumentsSection';
import OnboardingSettingsSection from './OnboardingSettingsSection';
import SessionManagementSection from './SessionManagementSection';
import TwoFactorSection from './TwoFactorSection';

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
  const user = useAuthUser();
  const { sharedDeviceMode, setSharedDeviceMode } = usePrivacySettingsStore();
  const sharedDeviceModeForced = isSharedDeviceModeForced();
  const [updatingPrivacyMode, setUpdatingPrivacyMode] = useState(false);
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

  const handleSharedDeviceModeChange = async (enabled: boolean) => {
    setUpdatingPrivacyMode(true);
    setSharedDeviceMode(enabled);

    if (enabled && user?.id) {
      clearEncounterLocalStateForUser(user.id);
      try {
        await clearPendingSavesForUser(user.id);
      } catch {
        // Ignore cleanup failures; the stricter mode still needs to be enabled.
      }
    }

    notify.success(
      enabled
        ? 'Modo equipo compartido activado. Se deshabilitó la persistencia local clínica en este navegador.'
        : 'Modo equipo compartido desactivado. Los borradores locales vuelven a estar disponibles en este navegador.',
    );
    setUpdatingPrivacyMode(false);
  };

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
            <div>
              <span className="block text-sm font-medium text-ink-secondary mb-1">
                Rol
              </span>
              <span className="inline-flex items-center rounded-pill bg-surface-inset px-3 py-1 text-xs font-bold text-ink-secondary">
                {userRole ?? 'Sin rol asignado'}
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

      <LegalDocumentsSection />

      <OnboardingSettingsSection />

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Privacidad del dispositivo</h2>
        </div>

        <p className="text-sm text-ink-muted mb-4">
          Este modo viene activo por defecto para deshabilitar borradores locales, copias recuperables en conflicto y
          cola offline clínica en navegadores compartidos o no verificados.
        </p>

        {sharedDeviceModeForced ? (
          <p className="text-sm text-status-green-text mb-4" role="status">
            Este entorno fuerza el modo equipo compartido por política global. La persistencia clínica local queda
            desactivada en todo momento.
          </p>
        ) : null}

        <label className="flex items-start gap-3 rounded-card border border-surface-muted/40 bg-surface-elevated/50 p-4 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={sharedDeviceMode}
            disabled={updatingPrivacyMode || sharedDeviceModeForced}
            onChange={(event) => {
              void handleSharedDeviceModeChange(event.target.checked);
            }}
            aria-label="Activar modo equipo compartido"
          />
          <div>
            <p className="text-sm font-semibold text-ink">Modo equipo compartido</p>
            <p className="mt-1 text-sm text-ink-secondary">
              La sesión sigue usando cookies seguras, pero los datos clínicos ya no se guardan localmente entre cortes,
              conflictos o trabajo offline.
            </p>
            <p className="mt-3 text-xs text-ink-muted">
              Úsalo en notebooks del centro, boxes compartidos o cualquier equipo donde no quieras dejar PHI persistida
              en almacenamiento del navegador.
            </p>
          </div>
        </label>
      </div>

      <SessionManagementSection />

      <TwoFactorSection />
    </div>
  );
}
