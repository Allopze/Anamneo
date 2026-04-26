import toast from 'react-hot-toast';
import { FiUsers } from 'react-icons/fi';
import ConfirmModal from '@/components/common/ConfirmModal';
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
              <div key={u.id} className="group list-row flex-col sm:flex-row sm:items-center">
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
                    <div className="text-xs text-ink-muted">Asignado a médico: {users?.find(m => m.id === u.medicoId)?.nombre || u.medicoId}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary" onClick={() => startEdit(u)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (confirm(`¿Restablecer la contraseña de ${u.nombre}?`)) {
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
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiUsers className="h-10 w-10 text-accent-text" />
            </div>
            <h3 className="empty-state-title">Sin usuarios cargados</h3>
            <p className="empty-state-description">No hay usuarios registrados todavía en esta instancia.</p>
          </div>
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
    </>
  );
}
