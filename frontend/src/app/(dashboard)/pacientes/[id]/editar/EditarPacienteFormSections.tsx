import Link from 'next/link';
import clsx from 'clsx';
import type { UseFormReturn } from 'react-hook-form';
import type { Patient } from '@/types';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import PossiblePatientDuplicatesNotice from '@/components/common/PossiblePatientDuplicatesNotice';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import type { EditForm } from './editar.constants';
import {
  IdentificacionSection,
  DemograficosSection,
  ContextoAdministrativoSection,
} from './EditarPacienteFormSections.parts';

interface EditarPacienteFormSectionsProps {
  id: string;
  patient: Patient;
  isDoctor: boolean;
  errorMsg: string | null;
  editForm: UseFormReturn<EditForm>;
  rutExempt: boolean;
  watchedNombre: string;
  watchedRut: string;
  watchedFechaNacimiento: string;
  edadCalculada: { edad: number; edadMeses: number } | null;
  completenessLabel: string;
  completenessDescription: string;
  editScopeLabel: string;
  rutStatusLabel: string;
  formStatusLabel: string;
  formStatusTone: string;
  isSaving: boolean;
  isDirty: boolean;
  errorCount: number;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export function EditarPacienteFormSections({
  id,
  patient,
  isDoctor,
  errorMsg,
  editForm,
  rutExempt,
  watchedNombre,
  watchedRut,
  watchedFechaNacimiento,
  edadCalculada,
  completenessLabel,
  completenessDescription,
  editScopeLabel,
  rutStatusLabel,
  formStatusLabel,
  formStatusTone,
  isSaving,
  isDirty,
  errorCount,
  onSubmit,
}: EditarPacienteFormSectionsProps) {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-12">
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/pacientes/${id}`} className="p-2 transition-colors hover:bg-surface-muted rounded-lg">
              <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Editar paciente</h1>
              <p className="text-ink-secondary">
                Ajusta la ficha de{' '}
                <span className="font-semibold text-ink-primary">{patient.nombre}</span> sin perder contexto clínico.
              </p>
            </div>
          </div>
          <Link href={`/pacientes/${id}`} className="btn btn-secondary text-sm">
            Volver a ficha
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="section-block space-y-1">
            <p className="text-xs font-semibold text-ink-muted">Alcance</p>
            <p className="text-sm font-semibold text-ink-primary">{editScopeLabel}</p>
            <p className="text-sm text-ink-secondary">
              {isDoctor
                ? 'Puedes corregir identificación y datos demográficos.'
                : 'El resto de la ficha clínica permanece bloqueado.'}
            </p>
          </div>
          <div className="section-block space-y-1">
            <p className="text-xs font-semibold text-ink-muted">Registro actual</p>
            <p className="text-sm font-semibold text-ink-primary">{completenessLabel}</p>
            <p className="text-sm text-ink-secondary">{completenessDescription}</p>
          </div>
          <div className="section-block space-y-1">
            <p className="text-xs font-semibold text-ink-muted">Identificación base</p>
            <p className="text-sm font-semibold text-ink-primary">{rutStatusLabel}</p>
            <p className="text-sm text-ink-secondary">
              Nacimiento: {patient.fechaNacimiento ? patient.fechaNacimiento.slice(0, 10) : 'Sin fecha registrada'}
            </p>
          </div>
        </div>

        <div className={clsx('section-callout', formStatusTone)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{formStatusLabel}</p>
              <p className="mt-1 text-sm">
                {isSaving
                  ? 'Estamos persistiendo los cambios del formulario.'
                  : errorCount > 0
                    ? 'Corrige los campos marcados antes de guardar.'
                    : isDirty
                      ? 'Los cambios todavía existen solo en esta sesión.'
                      : 'Puedes revisar y salir si no necesitas modificar nada más.'}
              </p>
            </div>
            <p className="text-sm text-ink-secondary">
              Paciente: <span className="font-semibold text-ink-primary">{patient.nombre}</span>
            </p>
          </div>
        </div>
      </div>

      {!isDoctor ? (
        <div className="mb-6 section-callout section-callout-warning">
          <p className="text-sm font-medium">Solo puedes editar datos administrativos del paciente.</p>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mb-6">
          <ErrorAlert message={errorMsg} />
        </div>
      ) : null}

      <div className="mb-6">
        <PossiblePatientDuplicatesNotice
          nombre={watchedNombre || patient.nombre}
          fechaNacimiento={watchedFechaNacimiento}
          rut={watchedRut}
          rutExempt={Boolean(rutExempt)}
          excludePatientId={patient.id}
        />
      </div>

      <form id="edit-paciente-form" onSubmit={onSubmit} className="space-y-6">
        <IdentificacionSection editForm={editForm} rutExempt={rutExempt} isDoctor={isDoctor} />
        <DemograficosSection editForm={editForm} edadCalculada={edadCalculada} />
        <ContextoAdministrativoSection editForm={editForm} />

        <div className="rounded-card border border-surface-muted/40 bg-surface-elevated/95 p-4 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-primary">{formStatusLabel}</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {errorCount > 0
                  ? 'Antes de guardar, revisa los campos resaltados.'
                  : isDirty
                    ? 'Cuando guardes, volverás a la ficha del paciente.'
                    : 'No hay cambios pendientes; puedes volver a la ficha cuando quieras.'}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Link href={`/pacientes/${id}`} className="btn btn-secondary">
                Cancelar
              </Link>
              <button type="submit" disabled={isSaving} className="btn btn-primary">
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FiSave className="w-4 h-4" />
                    Guardar cambios
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
