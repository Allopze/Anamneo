'use client';

import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiCheck, FiUsers } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { getErrorMessage } from '@/lib/api';
import {
  type Role,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_STYLES,
  formatInvitationDate,
} from './usuarios.constants';
import { useUsuarios } from './useUsuarios';
import { UsersCard } from './UsersCard';

export default function AdminUsuariosPage() {
  const {
    user,
    isAdmin,
    users,
    invitations,
    medicos,
    activeAdminCount,
    assistantGroups,
    isLoading,
    isLoadingInvitations,
    error,
    invitationsError,
    createForm,
    setCreateForm,
    createErrors,
    createdInvitation,
    createInvitationMutation,
    editingUser,
    setEditingUser,
    editForm,
    setEditForm,
    editErrors,
    updateUserMutation,
    toggleConfirmUser,
    setToggleConfirmUser,
    toggleActiveMutation,
    revokeInvitationMutation,
    resetPasswordMutation,
    generateTemporaryPassword,
    getInvitationStatus,
    startEdit,
    prefillAssistantForMedico,
  } = useUsuarios();

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Usuarios</h1>
          <p className="page-header-description">Crea médicos y asistentes, y administra sus relaciones operativas.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      <div className="card mb-6">
        <div className="panel-header">
          <div className="flex items-center gap-2">
          <FiPlus className="w-4 h-4 text-accent-text" />
          <h2 className="panel-title">Crear invitación</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-ink-secondary">
          El enlace permite que la persona complete su registro y defina su propia contraseña.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-ink-secondary">Email</label>
            <input
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-ink-secondary">Rol</label>
            <select
              className="form-input"
              value={createForm.role}
              onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as Role }))}
            >
              <option value="MEDICO">Médico</option>
              <option value="ASISTENTE">Asistente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          {createForm.role === 'ASISTENTE' && (
            <div className="md:col-span-2">
              <label className="text-sm text-ink-secondary">Asignar a médico</label>
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
            onClick={() => createInvitationMutation.mutate()}
            disabled={createInvitationMutation.isPending || createErrors.length > 0}
          >
            <FiUsers className="w-4 h-4" />
            Crear invitación
          </button>
          {createErrors.length > 0 && createForm.email.length > 0 && (
            <span className="text-xs text-status-red">{createErrors[0]}</span>
          )}
        </div>

        {createdInvitation && (
          <div className={`mt-4 rounded-card border p-4 ${createdInvitation.emailSent ? 'border-status-green/30 bg-status-green/10' : 'border-accent/20 bg-accent/10'}`}>
            <p className="text-sm font-medium text-ink-primary">
              {createdInvitation.emailSent
                ? `Invitación enviada a ${createdInvitation.email}`
                : 'Enlace de invitación listo'}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {createdInvitation.emailSent
                ? 'El correo salió con la configuración SMTP actual. Conserva el enlace como respaldo.'
                : 'No se pudo enviar automáticamente por correo. Puedes compartir este enlace manualmente.'}
            </p>
            {createdInvitation.emailError && (
              <p className="mt-2 text-xs text-accent-text">{createdInvitation.emailError}</p>
            )}
            <p className="mt-2 break-all text-sm text-ink-secondary">{createdInvitation.inviteUrl}</p>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Invitaciones</h2>
        </div>

        <p className="mb-4 text-sm text-ink-secondary">
          Revisa el estado de cada invitación pendiente. Para reenviar un enlace, crea una nueva invitación para el mismo correo.
        </p>

        {invitationsError && (
          <div className="mb-4">
            <ErrorAlert message={getErrorMessage(invitationsError)} />
          </div>
        )}

        {isLoadingInvitations ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded" />
            ))}
          </div>
        ) : invitations && invitations.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {invitations.map((invitation) => {
              const status = getInvitationStatus(invitation);
              const assignedMedico = invitation.medicoId
                ? users?.find((candidate) => candidate.id === invitation.medicoId)
                : null;
              const canRevoke = status === 'PENDIENTE';

              return (
                <div key={invitation.id} className="group list-row flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-primary truncate">{invitation.email}</span>
                      <span className="list-chip bg-surface-muted text-ink-secondary">
                        {invitation.role === 'MEDICO' ? 'Médico' : invitation.role === 'ADMIN' ? 'Administrador' : 'Asistente'}
                      </span>
                      <span className={`list-chip ${INVITATION_STATUS_STYLES[status]}`}>
                        {INVITATION_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      Creada: {formatInvitationDate(invitation.createdAt)} · Expira: {formatInvitationDate(invitation.expiresAt)}
                    </div>
                    {assignedMedico && (
                      <div className="text-xs text-ink-muted mt-1">
                        Asignada a médico: {assignedMedico.nombre} ({assignedMedico.email})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canRevoke && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                      >
                        Revocar
                      </button>
                    )}
                    {status === 'REVOCADA' && (
                      <span className="text-xs text-ink-muted">Enlace invalidado</span>
                    )}
                    {status === 'ACEPTADA' && (
                      <span className="text-xs text-status-green">Cuenta creada</span>
                    )}
                    {status === 'EXPIRADA' && (
                      <span className="text-xs text-accent-text">Crear nueva invitación</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-surface-muted/30 px-4 py-6 text-sm text-ink-muted">
            No hay invitaciones emitidas todavía.
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="panel-header">
          <h2 className="panel-title">Asignación de asistentes</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assistantGroups.map(({ medico, assistants }) => (
            <div key={medico.id} className="rounded-card border border-surface-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-ink-primary">{medico.nombre}</h3>
                  <p className="text-sm text-ink-muted">{medico.email}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {assistants.length} asistente{assistants.length === 1 ? '' : 's'} asignado{assistants.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => prefillAssistantForMedico(medico)}
                >
                  Crear asistente
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {assistants.length > 0 ? assistants.map((assistant) => (
                  <button
                    key={assistant.id}
                    className="w-full rounded-lg border border-surface-muted/30 px-3 py-2 text-left hover:border-accent/60 hover:bg-accent/10 transition-colors"
                    onClick={() => startEdit(assistant)}
                  >
                    <div className="font-medium text-ink-primary">{assistant.nombre}</div>
                    <div className="text-sm text-ink-muted">{assistant.email}</div>
                  </button>
                )) : (
                  <div className="rounded-lg border border-dashed border-surface-muted/30 px-3 py-4 text-sm text-ink-muted">
                    Sin asistentes asignados.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit */}
      {editingUser && (
        <div className="card mb-6 border-accent/20">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <FiEdit2 className="w-4 h-4 text-accent-text" />
              <h2 className="panel-title">Editar usuario</h2>
            </div>
            <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-ink-secondary">Nombre</label>
              <input
                className="form-input"
                value={editForm.nombre}
                onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Email</label>
              <input
                className="form-input"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Rol</label>
              <select
                className="form-input"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as Role }))}
              >
                <option value="MEDICO">Médico</option>
                <option value="ASISTENTE">Asistente</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            {editForm.role === 'ASISTENTE' && (
              <div className="md:col-span-2">
                <label className="text-sm text-ink-secondary">Asignar a médico</label>
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
              <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.checked }))}
                  disabled={editingUser.isAdmin && editingUser.active && activeAdminCount === 1}
                />
                Usuario activo
              </label>
              {editingUser.isAdmin && editingUser.active && activeAdminCount === 1 && (
                <p className="mt-2 text-xs text-accent-text">
                  Este es el último administrador activo y no puede desactivarse.
                </p>
              )}
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
              <span className="text-xs text-status-red">{editErrors[0]}</span>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-secondary">
            El cambio de contraseña administrativa se hace desde “Restablecer clave” para emitir una clave temporal
            y forzar recambio en el próximo ingreso.
          </p>
        </div>
      )}

      <UsersCard
        users={users}
        isLoading={isLoading}
        currentUserId={user?.id}
        activeAdminCount={activeAdminCount}
        toggleConfirmUser={toggleConfirmUser}
        setToggleConfirmUser={setToggleConfirmUser}
        toggleActiveMutation={toggleActiveMutation}
        resetPasswordMutation={resetPasswordMutation}
        generateTemporaryPassword={generateTemporaryPassword}
        startEdit={startEdit}
      />
    </div>
  );
}
