'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
// AssistantGroupsCard and EditUserCard are in ./usuarios.edit-cards
import { FiPlus } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { getErrorMessage } from '@/lib/api';
import {
  type Role,
  type AdminUserRow,
  type AdminInvitationRow,
  type CreatedInvitationState,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_STYLES,
  formatInvitationDate,
} from './usuarios.constants';

// ── Create invitation card ────────────────────────────────────────────

interface CreateInvitationCardProps {
  createForm: { email: string; role: Role; medicoId: string };
  createErrors: string[];
  createdInvitation: CreatedInvitationState | null;
  medicos: AdminUserRow[];
  createInvitationMutation: UseMutationResult<unknown, unknown, void>;
  setCreateForm: Dispatch<SetStateAction<{ email: string; role: Role; medicoId: string }>>;
}

export function CreateInvitationCard({
  createForm,
  createErrors,
  createdInvitation,
  medicos,
  createInvitationMutation,
  setCreateForm,
}: CreateInvitationCardProps) {
  return (
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
          Crear invitación
        </button>
        {createErrors.length > 0 && createForm.email.length > 0 && (
          <span className="text-xs text-status-red">{createErrors[0]}</span>
        )}
      </div>

      {createdInvitation && (
        <div
          className={`mt-4 rounded-card border p-4 ${
            createdInvitation.emailSent ? 'border-status-green/30 bg-status-green/10' : 'border-accent/20 bg-accent/10'
          }`}
        >
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
  );
}

// ── Invitations list card ─────────────────────────────────────────────

interface InvitationsListCardProps {
  invitations: AdminInvitationRow[] | undefined;
  isLoadingInvitations: boolean;
  invitationsError: Error | null;
  users: AdminUserRow[] | undefined;
  revokeInvitationMutation: UseMutationResult<unknown, unknown, string>;
  getInvitationStatus: (invitation: AdminInvitationRow) => string;
}

export function InvitationsListCard({
  invitations,
  isLoadingInvitations,
  invitationsError,
  users,
  revokeInvitationMutation,
  getInvitationStatus,
}: InvitationsListCardProps) {
  return (
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
                    <span className={`list-chip ${INVITATION_STATUS_STYLES[status as keyof typeof INVITATION_STATUS_STYLES]}`}>
                      {INVITATION_STATUS_LABELS[status as keyof typeof INVITATION_STATUS_LABELS]}
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
                  {status === 'REVOCADA' && <span className="text-xs text-ink-muted">Enlace invalidado</span>}
                  {status === 'ACEPTADA' && <span className="text-xs text-status-green">Cuenta creada</span>}
                  {status === 'EXPIRADA' && <span className="text-xs text-accent-text">Crear nueva invitación</span>}
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
  );
}
