import type { PatientHistory, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { parseStoredJson } from '../common/utils/encounter-sections';
import {
  PATIENT_HISTORY_FIELD_KEYS,
  type PatientHistoryFieldKey,
  type PatientHistoryFieldValue,
  sanitizePatientHistoryFieldValue,
} from '../common/utils/patient-history';
import type { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeNullableEmail,
  normalizeNullableString,
  resolvePatientVerificationState,
} from './patients-format';
import {
  buildAnamnesisRemotaSnapshotFromHistory,
  buildIdentificationSnapshotFromPatient,
  serializeSectionData,
} from '../encounters/encounters-sanitize';
import { buildEncryptedPatientIdentifierFields, withPatientIdentifiers } from './patients-identifiers';

export type LoadedPatient = NonNullable<Awaited<ReturnType<PrismaService['patient']['findUnique']>>> & {
  history: PatientHistory | null;
};

type MergeCounts = {
  encountersMoved: number;
  inProgressEncountersRebased: number;
  episodesMoved: number;
  episodeLinksReused: number;
  problemsMoved: number;
  tasksMoved: number;
  consentsMoved: number;
  alertsMoved: number;
};

export function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function preferTargetValue(target: string | null | undefined, source: string | null | undefined) {
  return hasText(target) ? target : source;
}

export function parseStoredHistoryValue(history: PatientHistory | null | undefined, key: PatientHistoryFieldKey) {
  const rawValue = history?.[key];
  if (!rawValue) {
    return null;
  }

  const parsed = parseStoredJson<PatientHistoryFieldValue | null>(rawValue, null);
  return sanitizePatientHistoryFieldValue(key, parsed, { rejectUnknownKeys: true }) ?? null;
}

export function mergeHistoryFieldValues(
  key: PatientHistoryFieldKey,
  targetValue: PatientHistoryFieldValue | null,
  sourceValue: PatientHistoryFieldValue | null,
) {
  const mergedItems = [...new Set([...(targetValue?.items ?? []), ...(sourceValue?.items ?? [])])];
  const targetText = targetValue?.texto?.trim();
  const sourceText = sourceValue?.texto?.trim();

  let mergedText: string | undefined;
  if (targetText && sourceText && targetText !== sourceText) {
    mergedText = targetText.includes(sourceText) ? targetText : `${targetText}\n\n${sourceText}`;
  } else {
    mergedText = targetText || sourceText || undefined;
  }

  const merged = sanitizePatientHistoryFieldValue(
    key,
    {
      ...(mergedText ? { texto: mergedText } : {}),
      ...(mergedItems.length > 0 ? { items: mergedItems } : {}),
    },
    { rejectUnknownKeys: true },
  );

  return merged ? JSON.stringify(merged) : null;
}

export function buildMergedHistoryUpdate(targetHistory: PatientHistory | null | undefined, sourceHistory: PatientHistory | null | undefined) {
  const updateData: Record<string, string | null> = {};

  for (const key of PATIENT_HISTORY_FIELD_KEYS) {
    const targetRawValue = targetHistory?.[key];
    const sourceRawValue = sourceHistory?.[key];
    const targetParsedValue = parseStoredHistoryValue(targetHistory, key);
    const sourceParsedValue = parseStoredHistoryValue(sourceHistory, key);

    if (!sourceParsedValue && typeof targetRawValue === 'string') {
      updateData[key] = targetRawValue;
      continue;
    }

    if (!targetParsedValue && typeof sourceRawValue === 'string') {
      updateData[key] = sourceRawValue;
      continue;
    }

    updateData[key] = mergeHistoryFieldValues(
      key,
      targetParsedValue,
      sourceParsedValue,
    );
  }

  return updateData;
}

export function buildTargetPatientMergeData(params: {
  targetPatient: LoadedPatient;
  sourcePatient: LoadedPatient;
  user: RequestUser;
}) {
  const { targetPatient, sourcePatient, user } = params;
  const targetIdentifiers = withPatientIdentifiers(targetPatient);
  const sourceIdentifiers = withPatientIdentifiers(sourcePatient);

  const targetHasRut = hasText(targetIdentifiers.rut);
  const sourceHasRut = hasText(sourceIdentifiers.rut);
  const shouldTransferRut = !targetHasRut && sourceHasRut;
  const shouldCopyRutExemption =
    !targetHasRut &&
    !targetPatient.rutExempt &&
    sourcePatient.rutExempt &&
    hasText(sourcePatient.rutExemptReason);
  const mergedIdentifiers = {
    rut: shouldTransferRut ? sourceIdentifiers.rut : targetIdentifiers.rut,
    nombre: targetIdentifiers.nombre,
    domicilio: normalizeNullableString(preferTargetValue(targetIdentifiers.domicilio, sourceIdentifiers.domicilio)),
    telefono: normalizeNullableString(preferTargetValue(targetIdentifiers.telefono, sourceIdentifiers.telefono)),
    email: normalizeNullableEmail(preferTargetValue(targetIdentifiers.email, sourceIdentifiers.email)),
    contactoEmergenciaNombre: normalizeNullableString(
      preferTargetValue(targetIdentifiers.contactoEmergenciaNombre, sourceIdentifiers.contactoEmergenciaNombre),
    ),
    contactoEmergenciaTelefono: normalizeNullableString(
      preferTargetValue(targetIdentifiers.contactoEmergenciaTelefono, sourceIdentifiers.contactoEmergenciaTelefono),
    ),
  };

  const updateData: Prisma.PatientUpdateInput = {
    ...buildEncryptedPatientIdentifierFields(mergedIdentifiers),
    rutExempt: shouldTransferRut ? false : (targetPatient.rutExempt || shouldCopyRutExemption),
    rutExemptReason: shouldTransferRut
      ? null
      : (targetPatient.rutExemptReason ?? (shouldCopyRutExemption ? sourcePatient.rutExemptReason : null)),
    fechaNacimiento: targetPatient.fechaNacimiento ?? sourcePatient.fechaNacimiento ?? null,
    edad: targetPatient.edad ?? sourcePatient.edad ?? null,
    edadMeses: targetPatient.edadMeses ?? sourcePatient.edadMeses ?? null,
    sexo: targetPatient.sexo ?? sourcePatient.sexo ?? null,
    prevision: targetPatient.prevision ?? sourcePatient.prevision ?? null,
    trabajo: normalizeNullableString(preferTargetValue(targetPatient.trabajo, sourcePatient.trabajo)),
    centroMedico: normalizeNullableString(preferTargetValue(targetPatient.centroMedico, sourcePatient.centroMedico)),
    registrationMode:
      targetPatient.registrationMode === 'COMPLETO' || sourcePatient.registrationMode === 'COMPLETO'
        ? 'COMPLETO'
        : 'RAPIDO',
  };

  const nextPatient = {
    ...targetPatient,
    ...targetIdentifiers,
    ...updateData,
    ...mergedIdentifiers,
  };

  Object.assign(
    updateData,
    resolvePatientVerificationState({
      currentPatient: targetPatient,
      nextPatient,
      actorId: user.id,
      actorRole: user.role,
      mode: 'UPDATE_FULL',
    }),
  );

  return {
    updateData,
    shouldTransferRut,
  };
}
