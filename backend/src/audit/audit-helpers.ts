export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export const CLINICAL_ENTITY_TYPES = new Set([
  'Patient',
  'PatientHistory',
  'Encounter',
  'EncounterSection',
  'PatientProblem',
  'EncounterTask',
]);

export const SAFE_CLINICAL_STRING_KEYS = new Set([
  'id',
  'patientId',
  'encounterId',
  'createdById',
  'archivedById',
  'reviewRequestedById',
  'reviewedById',
  'completedById',
  'uploadedById',
  'linkedOrderId',
  'linkedOrderType',
  'linkedOrderLabel',
  'status',
  'reviewStatus',
  'sectionKey',
  'scope',
  'format',
  'mime',
  'category',
  'type',
  'priority',
  'result',
  'reason',
  'createdAt',
  'updatedAt',
  'archivedAt',
  'restoredAt',
  'previousArchivedAt',
  'reviewRequestedAt',
  'reviewedAt',
  'completedAt',
  'dueDate',
  'onsetDate',
]);

export const SENSITIVE_FIELDS = ['passwordHash', 'password', 'refreshToken', 'accessToken'];

import { AuditAction, AuditReason, AuditResult } from '../common/types';
import { endOfAppDayUtcExclusive, startOfAppDayUtc } from '../common/utils/local-date';

export interface LogInput {
  entityType: string;
  entityId: string;
  userId: string;
  action: AuditAction;
  reason?: AuditReason;
  result?: AuditResult;
  diff?: any;
  requestId?: string;
}

export function parseDateFilter(value: string, boundary: 'start' | 'end') {
  if (DATE_ONLY_PATTERN.test(value)) {
    if (boundary === 'start') {
      return startOfAppDayUtc(value);
    }

    return new Date(endOfAppDayUtcExclusive(value).getTime() - 1);
  }

  return new Date(value);
}

function shouldKeepClinicalStringValue(key: string, value: string) {
  return SAFE_CLINICAL_STRING_KEYS.has(key)
    || DATE_ONLY_PATTERN.test(value)
    || ISO_DATE_TIME_PATTERN.test(value);
}

function summarizeClinicalValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    if (key && shouldKeepClinicalStringValue(key, value)) return value;
    return { redacted: true, length: value.length };
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) return { redacted: true, itemCount: value.length };

  if (typeof value !== 'object') return { redacted: true, valueType: typeof value };

  const summary: Record<string, unknown> = {
    redacted: true,
    fieldCount: Object.keys(value).length,
  };

  for (const [childKey, childValue] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.includes(childKey)) {
      summary[childKey] = '[REDACTED]';
      continue;
    }
    summary[childKey] = summarizeClinicalValue(childValue, childKey);
  }

  return summary;
}

export function sanitizeDiff(entityType: string, diff: any): any {
  if (!diff) return null;

  const sanitized = JSON.parse(JSON.stringify(diff));
  const shouldMinimizeClinicalPayload = CLINICAL_ENTITY_TYPES.has(entityType);

  if (shouldMinimizeClinicalPayload) {
    if (typeof sanitized !== 'object' || sanitized === null) {
      return { redacted: true, entityType, valueType: typeof sanitized };
    }
    const summarized = summarizeClinicalValue(sanitized, undefined);
    if (typeof summarized !== 'object' || summarized === null || Array.isArray(summarized)) {
      return { redacted: true, entityType, summary: summarized };
    }
    return { entityType, ...summarized };
  }

  const removeSensitive = (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of SENSITIVE_FIELDS) {
      if (key in obj) obj[key] = '[REDACTED]';
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') removeSensitive(value);
    }
  };

  removeSensitive(sanitized);
  return sanitized;
}
