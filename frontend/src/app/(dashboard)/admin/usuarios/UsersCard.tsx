import { useRef, useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import ConfirmModal from '@/components/common/ConfirmModal';
import { Dialog } from '@/components/common/Dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { type AdminUserRow, ROLE_LABELS, getPasswordError } from './usuarios.constants';

interface UsersCardProps {
  users: AdminUserRow[] | undefined;
  isLoading: boolean;
  currentUserId: string | undefined;
  activeAdminCount: number;
  toggleConfirmUser: AdminUserRow | null;
  setToggleConfirmUser: (u: AdminUserRow | null) => void;
  toggleActiveMutation: { mutate: (u: AdminUserRow) => void; isPending: boolean };
  resetPasswordMutation: {
    mutate: (payload: { userId: string; temporaryPassword: string }) => void;
    isPending: boolean;
  };
  generateTemporaryPassword: () => string;
  startEdit: (u: AdminUserRow) => void;
}

export function UsersCard({
  users,
  isLoading,
  currentUserId,
  activeAdminCount,
  toggleConfirmUser,
  setToggleConfirmUser,
  toggleActiveMutation,
  resetPasswordMutation,
  generateTemporaryPassword,
  startEdit,
}: UsersCardProps) {
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUserRow | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [temporaryPasswordError, setTemporaryPasswordError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const openResetPassword = (user: AdminUserRow) => {
    setResetPasswordUser(user);
    setTemporaryPassword(generateTemporaryPassword());
    setTemporaryPasswordError(null);
  };

  const closeResetPassword = () => {
    if (resetPasswordMutation.isPending) return;
    setResetPasswordUser(null);
    setTemporaryPassword('');
    setTemporaryPasswordError(null);
  };

  const confirmResetPassword = () => {
    if (!resetPasswordUser) return;

    const trimmedPassword = temporaryPassword.trim();
    const passwordError = getPasswordError(trimmedPassword, true);
    if (passwordError) {
      setTemporaryPasswordError(passwordError);
      return;
    }

    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      temporaryPassword: trimmedPassword,
    });
    setResetPasswordUser(null);
    setTemporaryPassword('');
    setTemporaryPasswordError(null);
  };

  return (
    <>
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
              <div key={u.id} className="group list-row flex-col items-stretch sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-primary truncate">
                    {u.nombre}
                  </div>
                  <div className="text-sm text-ink-muted truncate">{u.email}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="list-chip bg-surface-muted text-ink-secondary">
                      {ROLE_LABELS[u.role]}
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
                  {u.role === 'ASISTENTE' && u.medicoId && (
                    <div className="mt-1 truncate text-xs text-ink-muted">
                      Asignado a médico: {users?.find(m => m.id === u.medicoId)?.nombre || u.medicoId}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                  <button className="btn btn-secondary" onClick={() => startEdit(u)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => openResetPassword(u)}
                    disabled={resetPasswordMutation.isPending}
                  >
                    Restablecer clave
                  </button>
                  <button
                    className={u.active ? 'btn btn-danger' : 'btn btn-secondary'}
                    onClick={() => setToggleConfirmUser(u)}
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
                {currentUserId === u.id && (
                  <p className="text-xs text-ink-muted">Sesión actual</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FiUsers className="h-6 w-6" aria-hidden="true" />}
            title="Sin usuarios cargados"
            description="Cuando se registren usuarios de la clínica, aparecerán aquí con su rol, estado y acciones administrativas."
          />
        )}
      </div>

      <ConfirmModal
        isOpen={!!toggleConfirmUser}
        onClose={() => setToggleConfirmUser(null)}
        onConfirm={() => {
          if (toggleConfirmUser) toggleActiveMutation.mutate(toggleConfirmUser);
        }}
        title={toggleConfirmUser?.active ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          toggleConfirmUser?.active
            ? `¿Estás seguro de desactivar a ${toggleConfirmUser.nombre}? El usuario perderá acceso al sistema inmediatamente.`
            : `¿Estás seguro de activar a ${toggleConfirmUser?.nombre}? El usuario podrá ingresar al sistema nuevamente.`
        }
        confirmLabel={toggleConfirmUser?.active ? 'Desactivar' : 'Activar'}
        variant={toggleConfirmUser?.active ? 'danger' : 'info'}
        loading={toggleActiveMutation.isPending}
      />

      <Dialog
        isOpen={resetPasswordUser !== null}
        onClose={closeResetPassword}
        role="alertdialog"
        title="Restablecer clave"
        description={resetPasswordUser ? `Define una contraseña temporal para ${resetPasswordUser.nombre}. El usuario deberá cambiarla al iniciar sesión.` : ''}
        initialFocusRef={passwordInputRef}
        loading={resetPasswordMutation.isPending}
        maxWidth="md"
      >
        {resetPasswordUser && (
          <div className="p-6">
            <p className="text-sm font-semibold text-auth-teal">Acceso de usuario</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Restablecer clave</h2>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              Define una contraseña temporal para {resetPasswordUser.nombre}. El usuario deberá cambiarla al iniciar sesión.
            </p>

            <label htmlFor="temporary-password" className="form-label mt-5">
              Contraseña temporal
            </label>
            <input
              ref={passwordInputRef}
              id="temporary-password"
              type="text"
              className="form-input mt-1 font-mono"
              value={temporaryPassword}
              onChange={(event) => {
                setTemporaryPassword(event.target.value);
                setTemporaryPasswordError(null);
              }}
              disabled={resetPasswordMutation.isPending}
            />
            {temporaryPasswordError ? (
              <div className="mt-4">
                <ErrorAlert message={temporaryPasswordError} />
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeResetPassword}
                disabled={resetPasswordMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmResetPassword}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? 'Guardando...' : 'Restablecer clave'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
