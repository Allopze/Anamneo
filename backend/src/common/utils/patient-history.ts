import { BadRequestException } from '@nestjs/common';

export const PATIENT_HISTORY_FIELD_KEYS = [
  'antecedentesMedicos',
  'antecedentesQuirurgicos',
  'antecedentesGinecoobstetricos',
  'antecedentesFamiliares',
  'habitos',
  'medicamentos',
  'alergias',
  'inmunizaciones',
  'antecedentesSociales',
  'antecedentesPersonales',
] as const;

export type PatientHistoryFieldKey = typeof PATIENT_HISTORY_FIELD_KEYS[number];

const PATIENT_HISTORY_FIELD_LABELS: Record<PatientHistoryFieldKey, string> = {
  antecedentesMedicos: 'antecedentes médicos',
  antecedentesQuirurgicos: 'antecedentes quirúrgicos',
  antecedentesGinecoobstetricos: 'antecedentes ginecoobstétricos',
  antecedentesFamiliares: 'antecedentes familiares',
  habitos: 'hábitos',
  medicamentos: 'medicamentos',
  alergias: 'alergias',
  inmunizaciones: 'inmunizaciones',
  antecedentesSociales: 'antecedentes sociales',
  antecedentesPersonales: 'antecedentes personales',
};

export interface PatientHistoryFieldValue {
  texto?: string;
  items?: string[];
}

interface SanitizePatientHistoryOptions {
  allowString?: boolean;
  allowReadonly?: boolean;
  rejectUnknownKeys?: boolean;
}

function sanitizeHistoryText(value: unknown, label: string, maxLength = 4000) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`El campo ${label} debe ser texto`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function sanitizeHistoryItems(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException(`El campo ${label} debe incluir una lista válida`);
  }

  const seen = new Set<string>();
  const sanitized = value
    .slice(0, 100)
    .map((item) => {
      if (typeof item !== 'string') {
        throw new BadRequestException(`La lista de ${label} solo acepta texto`);
      }

      return item.trim().slice(0, 200);
    })
    .filter((item) => {
      if (!item) {
        return false;
      }

      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });

  return sanitized.length > 0 ? sanitized : undefined;
}

export function sanitizePatientHistoryFieldValue(
  key: PatientHistoryFieldKey,
  value: unknown,
  options: Pick<SanitizePatientHistoryOptions, 'allowString' | 'rejectUnknownKeys'> = {},
): PatientHistoryFieldValue | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const label = PATIENT_HISTORY_FIELD_LABELS[key];

  if (typeof value === 'string') {
    if (!options.allowString) {
      throw new BadRequestException(`El campo ${label} debe enviarse como objeto`);
    }

    const texto = sanitizeHistoryText(value, label);
    return texto ? { texto } : null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`El campo ${label} debe enviarse como objeto`);
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(['texto', 'items']);
  if (options.rejectUnknownKeys) {
    const unknownKeys = Object.keys(record).filter((entry) => !allowedKeys.has(entry));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`El campo ${label} contiene propiedades no soportadas`);
    }
  }

  const texto = sanitizeHistoryText(record.texto, label);
  const items = sanitizeHistoryItems(record.items, label);

  if (!texto && !items) {
    return null;
  }

  return {
    ...(texto ? { texto } : {}),
    ...(items ? { items } : {}),
  };
}

export function sanitizePatientHistoryPayload(
  payload: Record<string, unknown>,
  options: SanitizePatientHistoryOptions = {},
) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new BadRequestException('El historial del paciente debe enviarse como objeto');
  }

  const sanitized: Record<string, unknown> = {};

  for (const key of PATIENT_HISTORY_FIELD_KEYS) {
    const normalized = sanitizePatientHistoryFieldValue(key, payload[key], {
      allowString: options.allowString,
      rejectUnknownKeys: options.rejectUnknownKeys,
    });

    if (normalized !== undefined && normalized !== null) {
      sanitized[key] = normalized;
    }
  }

  if (options.allowReadonly && payload.readonly !== undefined) {
    if (typeof payload.readonly !== 'boolean') {
      throw new BadRequestException('El indicador readonly de anamnesis remota no es válido');
    }

    sanitized.readonly = payload.readonly;
  }

  return sanitized;
}
