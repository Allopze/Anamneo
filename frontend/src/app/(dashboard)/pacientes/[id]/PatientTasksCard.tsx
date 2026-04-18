import clsx from 'clsx';
import {
  TASK_PRIORITY_LABELS,
  TASK_RECURRENCE_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  type PatientTask,
} from '@/types';
import { extractDateOnly, formatDateOnly } from '@/lib/date';
import type { PatientDetailHook } from './usePatientDetail';
import { TASK_PRIORITIES } from './patient-detail.constants';

type Props = Pick<
  PatientDetailHook,
  'editingTaskId' | 'setEditingTaskId' | 'taskForm' | 'createTaskMutation' | 'updateTaskMutation'
> & {
  tasks: PatientTask[];
};

export default function PatientTasksCard({
  tasks,
  editingTaskId,
  setEditingTaskId,
  taskForm,
  createTaskMutation,
  updateTaskMutation,
}: Props) {
  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETADA' && t.status !== 'CANCELADA');
  const completedCount = tasks.length - pendingTasks.length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-ink">Seguimientos</h2>
        <span className="text-xs text-ink-muted">
          {pendingTasks.length} pendientes
          {completedCount > 0 ? ` · ${completedCount} cerrados ocultos` : ''}
        </span>
      </div>

      <div className="space-y-3">
        {pendingTasks.length > 0 ? (
          pendingTasks.map((task) => (
            <div key={task.id} className="rounded-card border border-surface-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-primary">{task.title}</p>
                  <p className="text-xs text-ink-muted">
                    {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]}
                    {` · ${TASK_PRIORITY_LABELS[task.priority]}`}
                    {task.recurrenceRule && task.recurrenceRule !== 'NONE'
                      ? ` · ${TASK_RECURRENCE_LABELS[task.recurrenceRule]}`
                      : ''}
                    {task.dueDate ? ` · ${formatDateOnly(task.dueDate)}` : ''}
                  </p>
                  {task.details && <p className="mt-1 text-sm text-ink-secondary">{task.details}</p>}
                </div>
                {task.status !== 'COMPLETADA' && (
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-ink-secondary hover:text-ink-primary"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        taskForm.reset({
                          title: task.title,
                          details: task.details || '',
                          type: task.type,
                          priority: task.priority,
                          recurrenceRule: task.recurrenceRule || 'NONE',
                          dueDate: extractDateOnly(task.dueDate) || '',
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-accent-text hover:text-ink"
                      onClick={() =>
                        updateTaskMutation.mutate({ taskId: task.id, payload: { status: 'COMPLETADA' } })
                      }
                    >
                      Completar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-muted">No hay seguimientos registrados.</p>
        )}
      </div>

      <form
        className="mt-4 space-y-2 border-t border-surface-muted/20 pt-4"
        onSubmit={taskForm.handleSubmit((data) => {
          if (editingTaskId) {
            updateTaskMutation.mutate({ taskId: editingTaskId, payload: data });
            return;
          }
          createTaskMutation.mutate(data);
        })}
      >
        <div>
          <input
            className={clsx('form-input', taskForm.formState.errors.title && 'border-status-red')}
            placeholder="Nuevo seguimiento o tarea"
            {...taskForm.register('title')}
          />
          {taskForm.formState.errors.title && (
            <p className="mt-1 text-xs text-status-red">{taskForm.formState.errors.title.message}</p>
          )}
        </div>
        <div>
          <textarea
            className={clsx('form-input form-textarea', taskForm.formState.errors.details && 'border-status-red')}
            rows={2}
            placeholder="Detalle clínico u operativo"
            {...taskForm.register('details')}
          />
          {taskForm.formState.errors.details && (
            <p className="mt-1 text-xs text-status-red">{taskForm.formState.errors.details.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="form-input" {...taskForm.register('type')}>
            {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select className="form-input" {...taskForm.register('priority')}>
            {TASK_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {TASK_PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="form-input" {...taskForm.register('recurrenceRule')}>
            {Object.entries(TASK_RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <input type="date" className="form-input" {...taskForm.register('dueDate')} />
          {taskForm.formState.errors.dueDate && (
            <p className="mt-1 text-xs text-status-red">{taskForm.formState.errors.dueDate.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-secondary w-full"
          disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
        >
          {editingTaskId ? 'Actualizar seguimiento' : 'Guardar seguimiento'}
        </button>
        {editingTaskId && (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => {
              setEditingTaskId(null);
              taskForm.reset();
            }}
          >
            Cancelar edición
          </button>
        )}
      </form>
    </div>
  );
}
