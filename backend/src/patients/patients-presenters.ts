import { Prisma } from '@prisma/client';
import { getPatientDemographicsMissingFields, hasPatientVerificationFieldChanges, isPatientDemographicsComplete } from '../common/utils/patient-completeness';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';

export function formatTask(task: any) {
  return {
    id: task.id,
    patientId: task.patientId,
    encounterId: task.encounterId ?? null,
    medicoId: task.medicoId ?? null,
    recurrenceSourceTaskId: task.recurrenceSourceTaskId ?? null,
    title: task.title,
    details: task.details ?? null,
    type: task.type,
    priority: task.priority,
    status: task.status,
    recurrenceRule: task.recurrenceRule ?? 'NONE',
    dueDate: task.dueDate ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isOverdue: task.isOverdue ?? undefined,
    createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
    patient: task.patient ? { id: task.patient.id, nombre: task.patient.nombre, rut: task.patient.rut } : undefined,
  };
}

export function formatProblem(problem: any) {
  return {
    id: problem.id,
    patientId: problem.patientId,
    encounterId: problem.encounterId ?? null,
    medicoId: problem.medicoId ?? null,
    createdById: problem.createdById ?? null,
    label: problem.label,
    status: problem.status,
    notes: problem.notes ?? null,
    severity: problem.severity ?? null,
    onsetDate: problem.onsetDate ?? null,
    resolvedAt: problem.resolvedAt ?? null,
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
    encounter: problem.encounter
      ? {
          id: problem.encounter.id,
          createdAt: problem.encounter.createdAt,
          status: problem.encounter.status,
        }
      : null,
    createdBy: problem.createdBy ? { id: problem.createdBy.id, nombre: problem.createdBy.nombre } : null,
  };
}

export function decoratePatient<T extends Record<string, any>>(patient: T) {
  return {
    id: patient.id,
    rut: patient.rut,
    rutExempt: patient.rutExempt,
    rutExemptReason: patient.rutExemptReason,
    nombre: patient.nombre,
    fechaNacimiento: patient.fechaNacimiento,
    edad: patient.edad,
    edadMeses: patient.edadMeses,
    sexo: patient.sexo,
    trabajo: patient.trabajo,
    prevision: patient.prevision,
    registrationMode: patient.registrationMode,
    completenessStatus: patient.completenessStatus,
    demographicsVerifiedAt: patient.demographicsVerifiedAt ?? null,
    demographicsVerifiedById: patient.demographicsVerifiedById ?? null,
    domicilio: patient.domicilio,
    telefono: patient.telefono ?? null,
    email: patient.email ?? null,
    contactoEmergenciaNombre: patient.contactoEmergenciaNombre ?? null,
    contactoEmergenciaTelefono: patient.contactoEmergenciaTelefono ?? null,
    centroMedico: patient.centroMedico,
    archivedAt: patient.archivedAt ?? null,
    archivedById: patient.archivedById ?? null,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    demographicsMissingFields: getPatientDemographicsMissingFields(patient),
    ...(patient.history !== undefined && { history: patient.history }),
    ...(patient.problems !== undefined && { problems: patient.problems.map((p: any) => formatProblem(p)) }),
    ...(patient.tasks !== undefined && { tasks: patient.tasks.map((t: any) => formatTask(t)) }),
    ...(patient.encounters !== undefined && { encounters: patient.encounters }),
    ...(patient._count !== undefined && { _count: patient._count }),
  };
}

export function formatAdminSummary(patient: {
  id: string;
  rut: string | null;
  rutExempt: boolean;
  rutExemptReason: string | null;
  nombre: string;
  fechaNacimiento: Date | null;
  edad: number | null;
  edadMeses: number | null;
  sexo: string | null;
  trabajo: string | null;
  prevision: string | null;
  registrationMode: string;
  completenessStatus: string;
  demographicsVerifiedAt: Date | null;
  demographicsVerifiedById: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  centroMedico: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  encounters: Array<{ createdAt: Date }>;
  _count: { encounters: number };
}) {
  const { encounters, _count, ...summary } = patient;

  return {
    id: summary.id,
    rut: summary.rut,
    rutExempt: summary.rutExempt,
    rutExemptReason: summary.rutExemptReason,
    nombre: summary.nombre,
    fechaNacimiento: summary.fechaNacimiento,
    edad: summary.edad,
    edadMeses: summary.edadMeses,
    sexo: summary.sexo,
    trabajo: summary.trabajo,
    prevision: summary.prevision,
    registrationMode: summary.registrationMode,
    completenessStatus: summary.completenessStatus,
    demographicsVerifiedAt: summary.demographicsVerifiedAt,
    demographicsVerifiedById: summary.demographicsVerifiedById,
    demographicsMissingFields: getPatientDemographicsMissingFields(summary),
    domicilio: summary.domicilio,
    telefono: summary.telefono,
    email: summary.email,
    contactoEmergenciaNombre: summary.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: summary.contactoEmergenciaTelefono,
    centroMedico: summary.centroMedico,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    createdBy: summary.createdBy,
    metrics: {
      encounterCount: _count.encounters,
      lastEncounterAt: encounters[0]?.createdAt ?? null,
    },
  };
}

export function resolvePatientVerificationState(params: {
  currentPatient?: Record<string, any> | null;
  nextPatient: Record<string, any>;
  actorId: string;
  actorRole?: string | null;
  mode: 'CREATE_FULL' | 'CREATE_QUICK' | 'UPDATE_FULL' | 'UPDATE_ADMIN' | 'VERIFY';
}) {
  const { currentPatient, nextPatient, actorId, actorRole, mode } = params;

  if (mode === 'CREATE_QUICK') {
    return {
      completenessStatus: 'INCOMPLETA',
      demographicsVerifiedAt: null,
      demographicsVerifiedById: null,
    } satisfies Prisma.PatientUpdateInput;
  }

  if (!isPatientDemographicsComplete(nextPatient)) {
    return {
      completenessStatus: 'INCOMPLETA',
      demographicsVerifiedAt: null,
      demographicsVerifiedById: null,
    } satisfies Prisma.PatientUpdateInput;
  }

  if (mode === 'VERIFY') {
    return {
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date(),
      demographicsVerifiedById: actorId,
    } satisfies Prisma.PatientUpdateInput;
  }

  const verificationFieldsChanged = currentPatient
    ? hasPatientVerificationFieldChanges(currentPatient, nextPatient)
    : true;

  if (actorRole === 'MEDICO') {
    if (
      currentPatient?.completenessStatus === 'VERIFICADA' &&
      !verificationFieldsChanged &&
      currentPatient.demographicsVerifiedAt
    ) {
      return {
        completenessStatus: 'VERIFICADA',
        demographicsVerifiedAt: currentPatient.demographicsVerifiedAt,
        demographicsVerifiedById: currentPatient.demographicsVerifiedById,
      } satisfies Prisma.PatientUpdateInput;
    }

    return {
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date(),
      demographicsVerifiedById: actorId,
    } satisfies Prisma.PatientUpdateInput;
  }

  if (currentPatient?.completenessStatus === 'VERIFICADA' && !verificationFieldsChanged) {
    return {
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: currentPatient.demographicsVerifiedAt,
      demographicsVerifiedById: currentPatient.demographicsVerifiedById,
    } satisfies Prisma.PatientUpdateInput;
  }

  return {
    completenessStatus: 'PENDIENTE_VERIFICACION',
    demographicsVerifiedAt: null,
    demographicsVerifiedById: null,
  } satisfies Prisma.PatientUpdateInput;
}