import type { UseFormRegister } from 'react-hook-form';
import { FiLock } from 'react-icons/fi';
import { ROLE_OPTIONS, type RegisterForm, type RegisterRole } from './register.constants';

interface RegisterRoleFieldProps {
  register: UseFormRegister<RegisterForm>;
  availableRoles: RegisterRole[];
  isInvitationMode: boolean;
  isLoadingRoles: boolean;
  disabled: boolean;
}

export default function RegisterRoleField({
  register,
  availableRoles,
  isInvitationMode,
  isLoadingRoles,
  disabled,
}: RegisterRoleFieldProps) {
  const onlyOneRole = availableRoles.length === 1;

  return (
    <div>
      <label className="form-label">Rol</label>
      {isLoadingRoles ? (
        <p className="text-micro text-ink-muted">Cargando opciones disponibles…</p>
      ) : onlyOneRole ? (
        <>
          <input type="hidden" value={availableRoles[0]} {...register('role')} />
          <div className="auth-role-pill">
            <FiLock className="auth-role-pill-icon" aria-hidden="true" />
            {ROLE_OPTIONS[availableRoles[0]].label}
          </div>
          <p className="mt-2 text-micro text-ink-muted">
            {isInvitationMode
              ? 'Rol fijado por invitación.'
              : 'Solo esta alta inicial habilita la cuenta administradora base.'}
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-1">
            {availableRoles.map((role) => (
              <label key={role} className="relative">
                <input type="radio" value={role} {...register('role')} disabled={disabled} className="peer sr-only" />
                <div className="auth-role-card peer-checked:border-auth-teal peer-checked:bg-auth-teal/[0.06]">
                  <div className="auth-role-indicator peer-checked:border-auth-teal peer-checked:bg-auth-teal" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary">{ROLE_OPTIONS[role].label}</p>
                    <p className="mt-1 text-xs text-ink-secondary">{ROLE_OPTIONS[role].description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
