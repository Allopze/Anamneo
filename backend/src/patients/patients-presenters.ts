import { Prisma } from '@prisma/client';
import { getPatientDemographicsMissingFields, hasPatientVerificationFieldChanges, isPatientDemographicsComplete } from '../common/utils/patient-completeness';
import { decryptField } from '../common/utils/field-crypto';

/**
 * Ley 21.719 Art 14 quinquies — Phase B: read-side switch.
 *
 * Si un campo tiene su contraparte `*_enc` poblada, descifrarla y usar el
 * resultado como fuente de verdad. Caer al plaintext si:
 *  - El campo `_enc` esta vacio (registro Phase A sin backfill).
 *  - El descifrado falla (clave rotada o corrupcion).
 *
 * Esto permite operar transparentemente durante la transicion hasta que
 * todos los registros tengan `*_enc` poblado y se eliminen los plaintext
 * en una migracion final.
 */
function decryptOrFallback(enc: string | null | undefined, plain: string | null | undefined): string | null {
  if (enc) {
    try {
      return decryptField(enc);
    } catch {
      // Fall through to plaintext if available
    }
  }
  return plain ?? null;
}

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
    rut: decryptOrFallback(patient.rutEnc, patient.rut),
    rutExempt: patient.rutExempt,
    rutExemptReason: patient.rutExemptReason,
    nombre: decryptOrFallback(patient.nombreEnc, patient.nombre) ?? patient.nombre,
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
    domicilio: decryptOrFallback(patient.domicilioEnc, patient.domicilio),
    telefono: decryptOrFallback(patient.telefonoEnc, patient.telefono),
    email: decryptOrFallback(patient.emailEnc, patient.email),
    contactoEmergenciaNombre: decryptOrFallback(patient.contactoEmergenciaNombreEnc, patient.contactoEmergenciaNombre),
    contactoEmergenciaTelefono: decryptOrFallback(patient.contactoEmergenciaTelefonoEnc, patient.contactoEmergenciaTelefono),
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
  // Campos `_enc` opcionales (Ley 21.719 Art 14 quinquies — read switch Phase B)
  rutEnc?: string | null;
  nombreEnc?: string | null;
  telefonoEnc?: string | null;
  emailEnc?: string | null;
  domicilioEnc?: string | null;
  contactoEmergenciaNombreEnc?: string | null;
  contactoEmergenciaTelefonoEnc?: string | null;
}) {
  const { encounters, _count, ...summary } = patient;

  return {
    id: summary.id,
    rut: decryptOrFallback(summary.rutEnc, summary.rut),
    rutExempt: summary.rutExempt,
    rutExemptReason: summary.rutExemptReason,
    nombre: decryptOrFallback(summary.nombreEnc, summary.nombre) ?? summary.nombre,
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
    domicilio: decryptOrFallback(summary.domicilioEnc, summary.domicilio),
    telefono: decryptOrFallback(summary.telefonoEnc, summary.telefono),
    email: decryptOrFallback(summary.emailEnc, summary.email),
    contactoEmergenciaNombre: decryptOrFallback(summary.contactoEmergenciaNombreEnc, summary.contactoEmergenciaNombre),
    contactoEmergenciaTelefono: decryptOrFallback(summary.contactoEmergenciaTelefonoEnc, summary.contactoEmergenciaTelefono),
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