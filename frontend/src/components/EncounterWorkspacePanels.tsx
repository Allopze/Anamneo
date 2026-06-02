'use client';

import Link from 'next/link';
import { FiActivity } from 'react-icons/fi';
import LocalizedDateInput from '@/components/common/LocalizedDateInput';
import { EncounterIcon } from '@/components/icons';
import FloatingQuickNotes from '@/components/FloatingQuickNotes';
import { REVIEW_STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { WORKFLOW_NOTE_MIN_LENGTH } from '@/lib/encounter-completion';
import { formatDateTime } from './encounter-workspace.constants';
import type { EncounterWorkspaceProps } from './encounter-workspace.constants';

export { CloseTabPanel } from './CloseTabPanel';

type ReviewTabPanelProps = Pick<
  EncounterWorkspaceProps,
  | 'encounter'
  | 'canEdit'
  | 'canRequestMedicalReview'
  | 'canMarkReviewedByDoctor'
  | 'canWriteReviewNote'
  | 'reviewActionNote'
  | 'onReviewActionNoteChange'
  | 'onReviewStatusChange'
  | 'reviewStatusPending'
  | 'generatedSummary'
  | 'onSaveGeneratedSummary'
>;

type SupportTabPanelProps = Pick<
  EncounterWorkspaceProps,
  | 'encounter'
  | 'quickNotesValue'
  | 'quickNotesDisabled'
  | 'quickNotesSaving'
  | 'onQuickNotesSave'
  | 'onOpenAttachments'
  | 'canEditAntecedentes'
  | 'canCreateFollowupTask'
  | 'quickTask'
  | 'onQuickTaskChange'
  | 'onCreateTask'
  | 'createTaskPending'
>;

export function ReviewTabPanel({
  encounter,
  canEdit,
  canRequestMedicalReview,
  canMarkReviewedByDoctor,
  canWriteReviewNote,
  reviewActionNote,
  onReviewActionNoteChange,
  onReviewStatusChange,
  reviewStatusPending,
  generatedSummary,
  onSaveGeneratedSummary,
}: ReviewTabPanelProps) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FiActivity className="h-4 w-4 text-ink-secondary" />
            <p className="text-sm font-semibold text-ink">
              {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            {encounter.reviewedAt
              ? `Última revisión · ${formatDateTime(encounter.reviewedAt)}`
              : encounter.reviewRequestedAt
                ? `Solicitada · ${formatDateTime(encounter.reviewRequestedAt)}`
                : 'Sin revisión pendiente'}
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-medium text-ink" htmlFor="workspace-review-note">
        Nota de revisión
      </label>
      <textarea
        id="workspace-review-note"
        name="review_note"
        className="form-input form-textarea mt-2 min-h-[132px]"
        value={reviewActionNote}
        onChange={(e) => onReviewActionNoteChange(e.target.value)}
        placeholder="Contexto clínico para la revisión médica…"
        readOnly={!canWriteReviewNote}
      />
      <p className="mt-2 text-xs text-ink-muted">
        {canMarkReviewedByDoctor
          ? `Obligatoria para marcar como revisada. Mínimo ${WORKFLOW_NOTE_MIN_LENGTH} caracteres.`
          : 'Opcional al enviar la atención a revisión médica.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canRequestMedicalReview && encounter.reviewStatus !== 'LISTA_PARA_REVISION' ? (
          <button
            className="toolbar-btn"
            onClick={() => onReviewStatusChange('LISTA_PARA_REVISION')}
            disabled={reviewStatusPending}
          >
            Enviar a Revisión Médica
          </button>
        ) : null}
        {canMarkReviewedByDoctor && encounter.reviewStatus !== 'REVISADA_POR_MEDICO' ? (
          <button
            className="toolbar-btn"
            onClick={() => onReviewStatusChange('REVISADA_POR_MEDICO')}
            disabled={reviewStatusPending}
          >
            Marcar Revisada
          </button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-surface-muted/35 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Resumen Clínico Generado</h3>
          {canEdit && generatedSummary ? (
            <button
              type="button"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
              onClick={onSaveGeneratedSummary}
            >
              Guardar Resumen
            </button>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-secondary">
          {generatedSummary || 'Completa más secciones para generar un resumen clínico automático.'}
        </p>
      </div>
    </div>
  );
}

export function SupportTabPanel({
  encounter,
  quickNotesValue,
  quickNotesDisabled,
  quickNotesSaving,
  onQuickNotesSave,
  onOpenAttachments,
  canEditAntecedentes,
  canCreateFollowupTask,
  quickTask,
  onQuickTaskChange,
  onCreateTask,
  createTaskPending,
}: SupportTabPanelProps) {
  return (
    <div className="px-5 py-5">
      <div className="grid gap-2">
        <FloatingQuickNotes
          value={quickNotesValue}
          disabled={quickNotesDisabled}
          saving={quickNotesSaving}
          onSave={onQuickNotesSave}
        />
        <button type="button" className="toolbar-btn" onClick={onOpenAttachments}>
          Adjuntos de la Atención
        </button>
        {canEditAntecedentes ? (
          <Link href={`/pacientes/${encounter.patientId}/historial`} className="toolbar-btn">
            Antecedentes del Paciente
          </Link>
        ) : null}
      </div>

      {canCreateFollowupTask ? (
        <form
          className="mt-5 flex flex-col gap-3 border-t border-surface-muted/35 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onCreateTask();
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <EncounterIcon className="h-4 w-4 text-ink-secondary" />
            Seguimiento Rápido
          </div>
          <input
            name="quick_task_title"
            className="form-input"
            value={quickTask.title}
            onChange={(e) => onQuickTaskChange({ ...quickTask, title: e.target.value })}
            placeholder="Ej.: revisar examen en 48 h…"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              name="quick_task_type"
              className="form-input"
              value={quickTask.type}
              onChange={(e) => onQuickTaskChange({ ...quickTask, type: e.target.value })}
            >
              {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <LocalizedDateInput
              id="quick-task-due-date"
              name="quick_task_due_date"
              className="form-input"
              value={quickTask.dueDate}
              onChange={(value) => onQuickTaskChange({ ...quickTask, dueDate: value })}
            />
          </div>
          <button
            type="submit"
            className="toolbar-btn-primary"
            disabled={!quickTask.title.trim() || createTaskPending}
          >
            {createTaskPending ? 'Creando…' : 'Crear Seguimiento'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
