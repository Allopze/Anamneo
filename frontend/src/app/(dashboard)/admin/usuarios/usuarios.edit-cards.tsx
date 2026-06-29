'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { FiCheck, FiEdit2 } from 'react-icons/fi';
import { type Role, type AdminUserRow } from './usuarios.constants';

interface AssistantGroup {
  medico: AdminUserRow;
  assistants: AdminUserRow[];
}

interface AssistantGroupsCardProps {
  assistantGroups: AssistantGroup[];
  prefillAssistantForMedico: (medico: AdminUserRow) => void;
  startEdit: (user: AdminUserRow) => void;
}

export function AssistantGroupsCard({ assistantGroups, prefillAssistantForMedico, startEdit }: AssistantGroupsCardProps) {
  return (
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
              {assistants.length > 0 ? (
                assistants.map((assistant) => (
                  <button
                    key={assistant.id}
                    className="w-full rounded-lg border border-surface-muted/30 px-3 py-2 text-left hover:border-accent/60 hover:bg-accent/10 transition-colors"
                    onClick={() => startEdit(assistant)}
                  >
                    <div className="font-medium text-ink-primary">{assistant.nombre}</div>
                    <div className="text-sm text-ink-muted">{assistant.email}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-surface-muted/30 px-3 py-4 text-sm text-ink-muted">
                  Sin asistentes asignados.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EditUserCardProps {
  editingUser: AdminUserRow | null;
  editForm: { nombre: string; email: string; role: Role; medicoId: string; active: boolean };
  editErrors: string[];
  medicos: AdminUserRow[];
  activeAdminCount: number;
  updateUserMutation: UseMutationResult<unknown, unknown, void>;
  setEditingUser: (u: AdminUserRow | null) => void;
  setEditForm: Dispatch<SetStateAction<{ nombre: string; email: string; role: Role; medicoId: string; active: boolean }>>;
}

export function EditUserCard({
  editingUser,
  editForm,
  editErrors,
  medicos,
  activeAdminCount,
  updateUserMutation,
  setEditingUser,
  setEditForm,
}: EditUserCardProps) {
  if (!editingUser) return null;

  return (
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
        El cambio de contraseña administrativa se hace desde "Restablecer clave" para emitir una clave temporal
        y forzar recambio en el próximo ingreso.
      </p>
    </div>
  );
}
