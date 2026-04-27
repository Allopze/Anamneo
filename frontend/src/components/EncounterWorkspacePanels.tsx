'use client';

import Link from 'next/link';
import { FiActivity, FiAlertCircle, FiCheck, FiClipboard } from 'react-icons/fi';
import clsx from 'clsx';

import FloatingQuickNotes from '@/components/FloatingQuickNotes';
import { REVIEW_STATUS_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { WORKFLOW_NOTE_MIN_LENGTH } from '@/lib/encounter-completion';
import { INNER_PANEL_CLASS, formatCompactDate, formatDateTime } from './encounter-workspace.constants';
import type { EncounterWorkspaceProps } from './encounter-workspace.constants';

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

type CloseTabPanelProps = Pick<
  EncounterWorkspaceProps,
  | 'encounter'
  | 'canComplete'
  | 'closureNote'
  | 'onClosureNoteChange'
  | 'completionChecklist'
  | 'generatedSummary'
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
            <FiClipboard className="h-4 w-4 text-ink-secondary" />
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
            <input
              type="date"
              name="quick_task_due_date"
              className="form-input"
              value={quickTask.dueDate}
              onChange={(e) => onQuickTaskChange({ ...quickTask, dueDate: e.target.value })}
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

export function CloseTabPanel({
  encounter,
  canComplete,
  closureNote,
  onClosureNoteChange,
  completionChecklist,
  generatedSummary,
}: CloseTabPanelProps) {
  const completionReadyCount = completionChecklist.filter((item) => item.status === 'ready').length;

  return (
    <div className="px-5 py-5">
      <div className={INNER_PANEL_CLASS}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Checklist de pre-cierre</h3>
              <p className="mt-1 text-sm text-ink-secondary">
                {completionReadyCount}/{completionChecklist.length} puntos listos antes de finalizar.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {completionChecklist.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  'rounded-input border px-3 py-3',
                  item.status === 'ready'
                    ? 'border-status-green/35 bg-status-green/10'
                    : 'border-status-yellow/45 bg-status-yellow/18',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                      item.status === 'ready'
                        ? 'bg-status-green/20 text-status-green-text'
                        : 'bg-status-yellow/35 text-accent-text',
                    )}
                  >
                    {item.status === 'ready' ? (
                      <FiCheck className="h-3.5 w-3.5" />
                    ) : (
                      <FiAlertCircle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{item.label}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div className={INNER_PANEL_CLASS}>
          <div className="px-4 py-3">
            <dt className="text-xs font-medium text-ink-muted">Revisión</dt>
            <dd className="mt-2 text-ink-secondary">
              Solicitada por {encounter.reviewRequestedBy?.nombre || '—'}
              {encounter.reviewRequestedAt ? ` · ${formatDateTime(encounter.reviewRequestedAt)}` : ''}
            </dd>
            <dd className="mt-1 text-ink-secondary">
              Revisada por {encounter.reviewedBy?.nombre || '—'}
              {encounter.reviewedAt ? ` · ${formatDateTime(encounter.reviewedAt)}` : ''}
            </dd>
          </div>
        </div>
        <div className={INNER_PANEL_CLASS}>
          <div className="px-4 py-3">
            <dt className="text-xs font-medium text-ink-muted">Cierre</dt>
            <dd className="mt-2 text-ink-secondary">
              Cerrada por {encounter.completedBy?.nombre || '—'}
              {encounter.completedAt ? ` · ${formatDateTime(encounter.completedAt)}` : ''}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-ink" htmlFor="workspace-closure-note">
          Nota de cierre
        </label>
        {canComplete && generatedSummary && !closureNote.trim() ? (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
            onClick={() => onClosureNoteChange(generatedSummary)}
          >
            Usar resumen generado
          </button>
        ) : null}
      </div>
      <textarea
        id="workspace-closure-note"
        name="closure_note"
        className="form-input form-textarea mt-2 min-h-[132px]"
        value={closureNote}
        onChange={(e) => onClosureNoteChange(e.target.value)}
        placeholder="Resumen clínico del cierre y próximos pasos…"
        readOnly={!canComplete}
      />

      <p className="mt-2 text-xs text-ink-muted">
        {canComplete
          ? `Obligatoria para finalizar la atención. Mínimo ${WORKFLOW_NOTE_MIN_LENGTH} caracteres.`
          : 'Resumen clínico y próximos pasos.'}
      </p>

      {encounter.tasks && encounter.tasks.length > 0 ? (
        <div className="mt-5 border-t border-surface-muted/35 pt-4">
          <h3 className="text-sm font-semibold text-ink">Seguimientos Vinculados</h3>
          <div className="mt-3 flex flex-col gap-2">
            {encounter.tasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-input border border-surface-muted/45 bg-surface-base/45 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{task.title}</p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-muted">
                  {formatCompactDate(task.dueDate || task.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
