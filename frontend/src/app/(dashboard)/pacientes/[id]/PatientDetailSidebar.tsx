'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { parseHistoryField } from '@/lib/utils';
import { formatDateOnly } from '@/lib/date';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientSex,
} from '@/lib/patient';
import PatientAlerts from '@/components/PatientAlerts';
import PatientConsents from '@/components/PatientConsents';
import PatientDataProcessingConsents from '@/components/PatientDataProcessingConsents';
import PatientBlockingControls from '@/components/PatientBlockingControls';
import PatientAllergiesList from '@/components/PatientAllergiesList';
import PatientCompletenessWidget from '@/components/PatientCompletenessWidget';
import PatientProblemsCard from './PatientProblemsCard';
import PatientTasksCard from './PatientTasksCard';
import PatientVitalsCard from './PatientVitalsCard';
import PatientLegalStatusSummary from './PatientLegalStatusSummary';
import type { PatientDetailHook } from './usePatientDetail';

type PatientDetail = NonNullable<PatientDetailHook['patient']>;

interface Props {
  patient: PatientDetail;
  pd: PatientDetailHook;
}

const historyFields = [
  { key: 'antecedentesMedicos', label: 'Médicos' },
  { key: 'antecedentesQuirurgicos', label: 'Quirúrgicos' },
  { key: 'antecedentesGinecoobstetricos', label: 'Ginecoobstétricos' },
  { key: 'antecedentesFamiliares', label: 'Familiares' },
  { key: 'habitos', label: 'Hábitos' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'alergias', label: 'Alergias', color: 'text-status-red' },
  { key: 'inmunizaciones', label: 'Inmunizaciones' },
  { key: 'antecedentesSociales', label: 'Sociales' },
  { key: 'antecedentesPersonales', label: 'Personales' },
] as const;

export default function PatientDetailSidebar({ patient, pd }: Props) {
  return (
    <div className="space-y-6 lg:col-span-1">
      <PatientCompletenessWidget patient={patient} />
      <PersonalInfoCard patient={patient} completenessLabel={pd.completenessMeta?.label} />
      {patient.history && <HistoryCard patient={patient} pd={pd} />}

      <PatientAllergiesList patientId={patient.id} />
      <PatientProblemsCard
        problems={patient.problems || []}
        editingProblemId={pd.editingProblemId}
        setEditingProblemId={pd.setEditingProblemId}
        problemForm={pd.problemForm}
        createProblemMutation={pd.createProblemMutation}
        updateProblemMutation={pd.updateProblemMutation}
      />
      <PatientTasksCard
        tasks={patient.tasks || []}
        editingTaskId={pd.editingTaskId}
        setEditingTaskId={pd.setEditingTaskId}
        taskForm={pd.taskForm}
        createTaskMutation={pd.createTaskMutation}
        updateTaskMutation={pd.updateTaskMutation}
      />
      <PatientVitalsCard
        clinicalSummary={pd.clinicalSummary}
        vitalTrend={pd.vitalTrend}
        showFullVitals={pd.showFullVitals}
        setShowFullVitals={pd.setShowFullVitals}
        selectedVitalKey={pd.selectedVitalKey}
        setSelectedVitalKey={pd.setSelectedVitalKey}
      />

      <div className="card">
        <PatientAlerts patientId={patient.id} />
      </div>
      <div className="card">
        <PatientConsents patientId={patient.id} />
      </div>
      <PatientDataProcessingConsents patientId={patient.id} patientAgeYears={patient.edad ?? null} />
      <PatientLegalStatusSummary legalStatus={patient.legalStatus} />
      <PatientBlockingControls
        patientId={patient.id}
        blockedAt={patient.blockedAt ?? null}
        blockedReason={patient.blockedReason ?? null}
        blockedById={patient.blockedById ?? null}
        isAdmin={Boolean(pd.isAdmin)}
      />
    </div>
  );
}

function PersonalInfoCard({ patient, completenessLabel }: { patient: PatientDetail; completenessLabel?: string }) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-bold text-ink">Información personal</h2>
      <dl className="space-y-3">
        <InfoItem label="RUT">
          {patient.rut || (
            <span className="text-ink-muted">
              Sin RUT {patient.rutExemptReason && `(${patient.rutExemptReason})`}
            </span>
          )}
        </InfoItem>
        <InfoItem label="Edad">{formatPatientAge(patient.edad, patient.edadMeses)}</InfoItem>
        {patient.fechaNacimiento && (
          <InfoItem label="Fecha de nacimiento">{formatDateOnly(patient.fechaNacimiento)}</InfoItem>
        )}
        <InfoItem label="Sexo">{formatPatientSex(patient.sexo)}</InfoItem>
        <InfoItem label="Previsión">{formatPatientPrevision(patient.prevision)}</InfoItem>
        {completenessLabel && <InfoItem label="Estado del registro">{completenessLabel}</InfoItem>}
        {patient.trabajo && <InfoItem label="Trabajo">{patient.trabajo}</InfoItem>}
        {patient.domicilio && <InfoItem label="Domicilio">{patient.domicilio}</InfoItem>}
        {patient.telefono && <InfoItem label="Teléfono">{patient.telefono}</InfoItem>}
        {patient.email && <InfoItem label="Email">{patient.email}</InfoItem>}
        {patient.contactoEmergenciaNombre && (
          <InfoItem label="Contacto de emergencia">
            {patient.contactoEmergenciaNombre}
            {patient.contactoEmergenciaTelefono ? ` · ${patient.contactoEmergenciaTelefono}` : ''}
          </InfoItem>
        )}
        {patient.centroMedico && <InfoItem label="Centro médico">{patient.centroMedico}</InfoItem>}
      </dl>
    </div>
  );
}

function InfoItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function HistoryCard({ patient, pd }: Props) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Antecedentes</h2>
        {pd.canEditAntecedentes && (
          <Link href={`/pacientes/${pd.id}/historial`} className="text-sm text-accent-text hover:text-ink">
            Editar
          </Link>
        )}
      </div>
      <div className="space-y-4 text-sm">
        {historyFields.map((field) => {
          const rawVal = (patient.history as any)[field.key];
          const val = parseHistoryField(rawVal);
          const hasItems = val?.items?.length > 0;
          const hasTexto = val?.texto && val.texto.trim().length > 0;
          if (!hasItems && !hasTexto) return null;
          return (
            <div key={field.key} className="border-l-2 border-surface-muted/30 py-1 pl-3">
              <dt className="mb-1 font-medium text-ink-muted">{field.label}</dt>
              <dd className={clsx('font-medium', 'color' in field ? field.color : 'text-ink-primary')}>
                {hasItems && val.items.join(', ')}
                {hasItems && hasTexto && <br />}
                {hasTexto && val.texto}
              </dd>
            </div>
          );
        })}
        {!pd.historyHasContent && <p className="text-ink-muted italic">No hay antecedentes registrados</p>}
      </div>
    </div>
  );
}
