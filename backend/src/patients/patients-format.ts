/**
 * Pure formatting/helper functions for patient data.
 * Extracted from PatientsService to keep the service focused on CRUD / workflow.
 */
import { parseStoredJson } from '../common/utils/encounter-sections';
import { ENCOUNTER_SECTION_LABELS, ENCOUNTER_SECTION_ORDER } from '../common/utils/encounter-section-meta';
import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import {
  formatTask,
} from './patients-presenters';

export {
  formatTask,
} from './patients-presenters';

export {
  decoratePatient,
  formatAdminSummary,
  formatProblem,
  resolvePatientVerificationState,
} from './patients-presenters';

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
