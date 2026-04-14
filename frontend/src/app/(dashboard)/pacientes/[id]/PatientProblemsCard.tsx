import clsx from 'clsx';
import { FiCheckCircle } from 'react-icons/fi';
import { PROBLEM_STATUS_LABELS, type PatientProblem } from '@/types';
import type { PatientDetailHook } from './usePatientDetail';

type Props = Pick<
  PatientDetailHook,
  'editingProblemId' | 'setEditingProblemId' | 'problemForm' | 'createProblemMutation' | 'updateProblemMutation'
> & {
  problems: PatientProblem[];
};

export default function PatientProblemsCard({
  problems,
  editingProblemId,
  setEditingProblemId,
  problemForm,
  createProblemMutation,
  updateProblemMutation,
}: Props) {
  const activeProblems = problems.filter((p) => p.status !== 'RESUELTO');
  const resolvedCount = problems.length - activeProblems.length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-ink">Problemas activos</h2>
        <span className="text-xs text-ink-muted">
          {activeProblems.length} activos
          {resolvedCount > 0 ? ` · ${resolvedCount} resueltos ocultos` : ''}
        </span>
      </div>

      <div className="space-y-3">
        {activeProblems.length > 0 ? (
          activeProblems.map((problem) => (
            <div key={problem.id} className="rounded-card border border-surface-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-primary">{problem.label}</p>
                  <p className="text-xs text-ink-muted">
                    {PROBLEM_STATUS_LABELS[problem.status]}
                    {problem.severity ? ` · ${problem.severity}` : ''}
                  </p>
                  {problem.notes && <p className="mt-1 text-sm text-ink-secondary">{problem.notes}</p>}
                </div>
                {problem.status !== 'RESUELTO' && (
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-ink-secondary hover:text-ink-primary"
                      onClick={() => {
                        setEditingProblemId(problem.id);
                        problemForm.reset({
                          label: problem.label,
                          notes: problem.notes || '',
                          status: problem.status,
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-accent-text hover:text-ink"
                      onClick={() =>
                        updateProblemMutation.mutate({ problemId: problem.id, payload: { status: 'RESUELTO' } })
                      }
                    >
                      Resolver
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-muted">No hay problemas clínicos registrados.</p>
        )}
      </div>

      <form
        className="mt-4 space-y-2 border-t border-surface-muted/20 pt-4"
        onSubmit={problemForm.handleSubmit((data) => {
          if (editingProblemId) {
            updateProblemMutation.mutate({ problemId: editingProblemId, payload: data });
            return;
          }
          createProblemMutation.mutate(data);
        })}
      >
        <div>
          <input
            className={clsx('form-input', problemForm.formState.errors.label && 'border-status-red')}
            placeholder="Nuevo problema clínico"
            {...problemForm.register('label')}
          />
          {problemForm.formState.errors.label && (
            <p className="mt-1 text-xs text-status-red">{problemForm.formState.errors.label.message}</p>
          )}
        </div>
        <div>
          <textarea
            className={clsx('form-input form-textarea', problemForm.formState.errors.notes && 'border-status-red')}
            rows={2}
            placeholder="Notas o contexto"
            {...problemForm.register('notes')}
          />
          {problemForm.formState.errors.notes && (
            <p className="mt-1 text-xs text-status-red">{problemForm.formState.errors.notes.message}</p>
          )}
        </div>
        <select className="form-input" {...problemForm.register('status')}>
          {Object.entries(PROBLEM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn btn-secondary w-full"
          disabled={createProblemMutation.isPending || updateProblemMutation.isPending}
        >
          {editingProblemId ? 'Actualizar problema' : 'Guardar problema'}
        </button>
        {editingProblemId && (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => {
              setEditingProblemId(null);
              problemForm.reset();
            }}
          >
            Cancelar edición
          </button>
        )}
      </form>
    </div>
  );
}
