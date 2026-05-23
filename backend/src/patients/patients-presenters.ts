import { Prisma } from '@prisma/client';
import { getPatientDemographicsMissingFields, hasPatientVerificationFieldChanges, isPatientDemographicsComplete } from '../common/utils/patient-completeness';
import { resolvePatientIdentifiers, withPatientIdentifiers } from './patients-identifiers';

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
    patient: task.patient ? { id: task.patient.id, ...resolvePatientIdentifiers(task.patient) } : undefined,
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
  const identifiers = resolvePatientIdentifiers(patient);
  const patientForCompleteness = { ...patient, ...identifiers };

  return {
    id: patient.id,
    rut: identifiers.rut,
    rutExempt: patient.rutExempt,
    rutExemptReason: patient.rutExemptReason,
    nombre: identifiers.nombre,
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
    domicilio: identifiers.domicilio,
    telefono: identifiers.telefono,
    email: identifiers.email,
    contactoEmergenciaNombre: identifiers.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: identifiers.contactoEmergenciaTelefono,
    centroMedico: patient.centroMedico,
    archivedAt: patient.archivedAt ?? null,
    archivedById: patient.archivedById ?? null,
    // Ley 21.719 Art 8 ter — exponer estado de bloqueo a UI admin.
    blockedAt: patient.blockedAt ?? null,
    blockedReason: patient.blockedReason ?? null,
    blockedById: patient.blockedById ?? null,
    // Ley 21.719 Art 16 quater — representante legal NNA
    legalRepresentativeName: patient.legalRepresentativeName ?? null,
    legalRepresentativeRut: patient.legalRepresentativeRut ?? null,
    legalRepresentativeRelationship: patient.legalRepresentativeRelationship ?? null,
    legalRepresentativeContact: patient.legalRepresentativeContact ?? null,
    // Ley 21.719 Art 8 — flags de oposicion por finalidad
    processingObjections: patient.processingObjections ?? null,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    demographicsMissingFields: getPatientDemographicsMissingFields(patientForCompleteness),
    ...(patient.history !== undefined && { history: patient.history }),
    ...(patient.problems !== undefined && { problems: patient.problems.map((p: any) => formatProblem(p)) }),
    ...(patient.tasks !== undefined && { tasks: patient.tasks.map((t: any) => formatTask(t)) }),
    ...(patient.encounters !== undefined && { encounters: patient.encounters }),
    ...(patient._count !== undefined && { _count: patient._count }),
  };
}

export function formatAdminSummary(patient: {
  id: string;
  rutExempt: boolean;
  rutExemptReason: string | null;
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
  rutEnc: string | null;
  nombreEnc: string | null;
  telefonoEnc: string | null;
  emailEnc: string | null;
  domicilioEnc: string | null;
  contactoEmergenciaNombreEnc: string | null;
  contactoEmergenciaTelefonoEnc: string | null;
}) {
  const { encounters, _count, ...summary } = patient;
  const identifiers = resolvePatientIdentifiers(summary);
  const summaryForCompleteness = withPatientIdentifiers(summary);

  return {
    id: summary.id,
    rut: identifiers.rut,
    rutExempt: summary.rutExempt,
    rutExemptReason: summary.rutExemptReason,
    nombre: identifiers.nombre,
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
    demographicsMissingFields: getPatientDemographicsMissingFields(summaryForCompleteness),
    domicilio: identifiers.domicilio,
    telefono: identifiers.telefono,
    email: identifiers.email,
    contactoEmergenciaNombre: identifiers.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: identifiers.contactoEmergenciaTelefono,
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
