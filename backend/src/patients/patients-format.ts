/**
 * Pure formatting/helper functions for patient data.
 * Extracted from PatientsService to keep the service focused on CRUD / workflow.
 */
import { Prisma } from '@prisma/client';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { ENCOUNTER_SECTION_LABELS, ENCOUNTER_SECTION_ORDER } from '../common/utils/encounter-section-meta';
import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import {
  getPatientDemographicsMissingFields,
  hasPatientVerificationFieldChanges,
  isPatientDemographicsComplete,
} from '../common/utils/patient-completeness';

// ─── Record formatters ───────────────────────────────────────────────────────

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

// ─── Verification state ──────────────────────────────────────────────────────

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

// ─── Small helpers ───────────────────────────────────────────────────────────

export function normalizeNullableString(value: string | null | undefined, trim = true) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trim ? value.trim() : value;
  return normalized.length > 0 ? normalized : null;
}

export function normalizeNullableEmail(value: string | null | undefined) {
  const normalized = normalizeNullableString(value);
  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
}

export function matchesClinicalSearch(rawData: unknown, clinicalSearch: string) {
  const parsed = parseStoredJson(rawData, null);
  if (parsed === null || parsed === undefined) {
    return false;
  }

  return JSON.stringify(parsed).toLowerCase().includes(clinicalSearch);
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

export function neutralizeCsvField(value: string) {
  const trimmed = value.trimStart();
  if (!trimmed || !['=', '+', '-', '@'].includes(trimmed[0])) {
    return value;
  }

  return `'${value}`;
}

export function toCsvCell(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined || value === '' ? '-' : String(value);
  const escaped = neutralizeCsvField(normalized).replace(/"/g, '""');
  return `"${escaped}"`;
}

// ─── Encounter timeline / clinical summary formatters ────────────────────────

function getEncounterSectionData<T extends Record<string, unknown>>(encounter: any, sectionKey: SectionKey) {
  const section = (encounter.sections || []).find((item: any) => item.sectionKey === sectionKey);
  if (!section) {
    return {} as T;
  }

  return formatEncounterSectionForRead(section).data as T;
}

export function formatEncounterTimelineItem(encounter: any) {
  const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
    return (
      ENCOUNTER_SECTION_ORDER.indexOf(a.sectionKey as SectionKey) -
      ENCOUNTER_SECTION_ORDER.indexOf(b.sectionKey as SectionKey)
    );
  });

  return {
    id: encounter.id,
    patientId: encounter.patientId,
    createdById: encounter.createdById,
    status: encounter.status,
    reviewStatus: encounter.reviewStatus,
    reviewRequestedAt: encounter.reviewRequestedAt,
    reviewNote: encounter.reviewNote,
    reviewedAt: encounter.reviewedAt,
    completedAt: encounter.completedAt,
    closureNote: encounter.closureNote,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    createdBy: encounter.createdBy,
    reviewRequestedBy: encounter.reviewRequestedBy,
    reviewedBy: encounter.reviewedBy,
    completedBy: encounter.completedBy,
    tasks: (encounter.tasks || []).map((task: any) => formatTask(task)),
    progress: {
      completed: sortedSections.filter((section) => section.completed).length,
      total: ENCOUNTER_SECTION_ORDER.length,
    },
    sections: sortedSections.map((section: any) => ({
      ...formatEncounterSectionForRead({
        ...section,
        data: parseStoredJson(section.data, {}),
      }),
      label: ENCOUNTER_SECTION_LABELS[section.sectionKey as SectionKey],
      order: ENCOUNTER_SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
    })),
  };
}

function buildEncounterSummaryLines(encounter: any) {
  const motivo = getEncounterSectionData<{ texto?: string }>(encounter, 'MOTIVO_CONSULTA');
  const diagnostico = getEncounterSectionData<{ sospechas?: Array<{ diagnostico?: string }> }>(
    encounter,
    'SOSPECHA_DIAGNOSTICA',
  );
  const tratamiento = getEncounterSectionData<{ plan?: string; indicaciones?: string }>(
    encounter,
    'TRATAMIENTO',
  );
  const respuesta = getEncounterSectionData<{ planSeguimiento?: string }>(encounter, 'RESPUESTA_TRATAMIENTO');
  const observaciones = getEncounterSectionData<{ resumenClinico?: string }>(encounter, 'OBSERVACIONES');
  const treatmentPlan = tratamiento.plan?.trim() || tratamiento.indicaciones?.trim() || '';

  const lines = [
    motivo.texto?.trim(),
    diagnostico.sospechas?.length
      ? `Dx: ${diagnostico.sospechas
          .slice(0, 3)
          .map((item) => item.diagnostico?.trim())
          .filter(Boolean)
          .join(', ')}`
      : '',
    treatmentPlan ? `Plan: ${treatmentPlan}` : '',
    respuesta.planSeguimiento?.trim() ? `Seguimiento: ${respuesta.planSeguimiento.trim()}` : '',
    observaciones.resumenClinico?.trim() ? `Resumen: ${observaciones.resumenClinico.trim()}` : '',
  ].filter((value): value is string => Boolean(value));

  return lines.slice(0, 4);
}

export function buildClinicalSummary(
  encounters: any[],
  patient: any,
  counts: {
    totalEncounters: number;
    activeProblems: number;
    pendingTasks: number;
  },
  options?: { fullVitals?: boolean },
) {
  const diagnosisMap = new Map<string, { label: string; count: number; lastSeenAt: Date }>();
  let vitalTrend = encounters
    .map((encounter) => {
      const examen = getEncounterSectionData<{
        signosVitales?: Record<string, unknown>;
      }>(encounter, 'EXAMEN_FISICO');
      const signos = examen.signosVitales;

      if (!signos || typeof signos !== 'object') {
        return null;
      }

      return {
        encounterId: encounter.id,
        createdAt: encounter.createdAt,
        presionArterial: typeof signos.presionArterial === 'string' ? signos.presionArterial : null,
        peso: signos.peso ? Number(signos.peso) : null,
        imc: signos.imc ? Number(signos.imc) : null,
        temperatura: signos.temperatura ? Number(signos.temperatura) : null,
        saturacionOxigeno: signos.saturacionOxigeno ? Number(signos.saturacionOxigeno) : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter(
      (item) =>
        item.presionArterial ||
        item.peso !== null ||
        item.imc !== null ||
        item.temperatura !== null ||
        item.saturacionOxigeno !== null,
    );
  if (!options?.fullVitals) {
    vitalTrend = vitalTrend.slice(0, 6);
  }

  for (const encounter of encounters) {
    const diagnostico = getEncounterSectionData<{
      sospechas?: Array<{ diagnostico?: string }>;
    }>(encounter, 'SOSPECHA_DIAGNOSTICA');

    for (const sospecha of diagnostico.sospechas || []) {
      const label = sospecha.diagnostico?.trim();
      if (!label) {
        continue;
      }

      const normalizedLabel = label.toLowerCase();
      const existing = diagnosisMap.get(normalizedLabel);
      if (existing) {
        existing.count += 1;
        if (encounter.createdAt > existing.lastSeenAt) {
          existing.lastSeenAt = encounter.createdAt;
        }
        continue;
      }

      diagnosisMap.set(normalizedLabel, {
        label,
        count: 1,
        lastSeenAt: encounter.createdAt,
      });
    }
  }

  const recentDiagnoses = [...diagnosisMap.values()]
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    })
    .slice(0, 5)
    .map((item) => ({
      label: item.label,
      count: item.count,
      lastSeenAt: item.lastSeenAt,
    }));

  return {
    patientId: patient.id,
    generatedAt: new Date().toISOString(),
    counts,
    latestEncounterSummary: encounters[0]
      ? {
          encounterId: encounters[0].id,
          createdAt: encounters[0].createdAt,
          lines: buildEncounterSummaryLines(encounters[0]),
        }
      : null,
    vitalTrend,
    recentDiagnoses,
    activeProblems: patient.problems.map((problem: any) => ({
      id: problem.id,
      label: problem.label,
      status: problem.status,
      severity: problem.severity,
      updatedAt: problem.updatedAt,
    })),
    pendingTasks: patient.tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      type: task.type,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
    })),
  };
}
