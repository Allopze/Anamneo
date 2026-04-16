/**
 * Pure-function section sanitizers for encounter data.
 * Extracted from EncountersService to keep the service focused on CRUD / workflow.
 */
import { SectionKey } from '../common/types';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { getEncounterSectionSchemaVersion } from '../common/utils/encounter-section-meta';
import {
  PATIENT_HISTORY_FIELD_KEYS,
  sanitizePatientHistoryFieldValue,
} from '../common/utils/patient-history';
import { encryptField, isEncryptionEnabled } from '../common/utils/field-crypto';
import {
  sanitizeExamenFisicoData,
  sanitizeRespuestaTratamientoData,
  sanitizeSospechaDiagnosticaData,
  sanitizeTratamientoData,
} from './encounters-sanitize-clinical';
import {
  sanitizeAnamnesisProximaData,
  sanitizeAnamnesisRemotaData,
  sanitizeIdentificacionData,
  sanitizeMotivoConsultaData,
  sanitizeObservacionesData,
  sanitizeRevisionSistemasData,
} from './encounters-sanitize-intake';

export {
  REVIEW_NOTE_MIN_LENGTH,
  sanitizeText,
  sanitizeTextListField,
  sanitizeNumericStringField,
  sanitizePressureField,
  sanitizeRequiredWorkflowNote,
  sanitizeStructuredMedication,
  sanitizeStructuredOrder,
} from './encounters-sanitize-primitives';

export {
  sanitizeExamenFisicoData,
  sanitizeTratamientoData,
  sanitizeRespuestaTratamientoData,
  sanitizeSospechaDiagnosticaData,
} from './encounters-sanitize-clinical';

export {
  sanitizeMotivoConsultaData,
  sanitizeAnamnesisProximaData,
  sanitizeAnamnesisRemotaData,
  sanitizeRevisionSistemasData,
  sanitizeObservacionesData,
  sanitizeIdentificacionData,
} from './encounters-sanitize-intake';

// ─── Constants ───────────────────────────────────────────────────────────────

export const REQUIRED_COMPLETION_SECTIONS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const REQUIRED_SEMANTIC_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const VITAL_SIGNS_ALERT_GENERATION_WARNING =
  'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.';

// ─── Serialization ───────────────────────────────────────────────────────────

export function serializeSectionData(data: unknown): string {
  const json = JSON.stringify(data);
  return isEncryptionEnabled() ? encryptField(json) : json;
}

export function parseSectionData(rawData: unknown): unknown {
  return parseStoredJson(rawData, null);
}

export function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulContent(item));
  }

  return false;
}

/**
 * Dispatch to the appropriate section-level sanitizer.
 */
export function sanitizeSectionPayload(sectionKey: SectionKey, data: Record<string, unknown>) {
  if (sectionKey === 'IDENTIFICACION') {
    return sanitizeIdentificacionData(data);
  }

  if (sectionKey === 'MOTIVO_CONSULTA') {
    return sanitizeMotivoConsultaData(data);
  }

  if (sectionKey === 'ANAMNESIS_PROXIMA') {
    return sanitizeAnamnesisProximaData(data);
  }

  if (sectionKey === 'ANAMNESIS_REMOTA') {
    return sanitizeAnamnesisRemotaData(data);
  }

  if (sectionKey === 'REVISION_SISTEMAS') {
    return sanitizeRevisionSistemasData(data);
  }

  if (sectionKey === 'EXAMEN_FISICO') {
    return sanitizeExamenFisicoData(data);
  }

  if (sectionKey === 'SOSPECHA_DIAGNOSTICA') {
    return sanitizeSospechaDiagnosticaData(data);
  }

  if (sectionKey === 'TRATAMIENTO') {
    return sanitizeTratamientoData(data);
  }

  if (sectionKey === 'RESPUESTA_TRATAMIENTO') {
    return sanitizeRespuestaTratamientoData(data);
  }

  if (sectionKey === 'OBSERVACIONES') {
    return sanitizeObservacionesData(data);
  }

  return data;
}

// ─── Audit helpers ───────────────────────────────────────────────────────────

export function summarizeSectionAuditData(sectionKey: SectionKey, data: unknown, completed?: boolean) {
  const topLevelKeys =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? Object.keys(data as Record<string, unknown>)
      : [];

  return {
    sectionKey,
    schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
    completed,
    topLevelKeys,
    fieldCount: topLevelKeys.length,
    redacted: true,
  };
}

export function summarizeWorkflowNoteAudit(note: string | null | undefined) {
  if (!note) {
    return null;
  }

  return {
    redacted: true,
    provided: true,
    length: note.length,
  };
}

// ─── Snapshot helpers ────────────────────────────────────────────────────────

export function buildAnamnesisRemotaSnapshotFromHistory(history: any) {
  const snapshot: Record<string, unknown> = {
    readonly: true,
  };

  for (const key of PATIENT_HISTORY_FIELD_KEYS) {
    try {
      const rawValue = parseStoredJson(history?.[key], history?.[key]);
      const sanitized = sanitizePatientHistoryFieldValue(key, rawValue, {
        allowString: true,
      });

      if (sanitized !== undefined && sanitized !== null) {
        snapshot[key] = sanitized;
      }
    } catch {
      // Legacy malformed history should not block opening a new encounter.
    }
  }

  return snapshot;
}

export {
  IDENTIFICATION_SNAPSHOT_FIELD_META,
  buildIdentificationSnapshotFromPatient,
  normalizeIdentificationComparisonValue,
  matchesCurrentPatientSnapshot,
  buildIdentificationSnapshotStatus,
} from './encounters-identification-snapshot';

// ─── Response formatters ─────────────────────────────────────────────────────

export function formatTask(task: any) {
  return {
    id: task.id,
    patientId: task.patientId,
    encounterId: task.encounterId ?? null,
    title: task.title,
    details: task.details ?? null,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isOverdue: task.isOverdue ?? undefined,
    createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
  };
}
