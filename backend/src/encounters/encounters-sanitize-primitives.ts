import { BadRequestException } from '@nestjs/common';
import { sanitizeClinicalText } from '../common/utils/sanitize-html';

const ORDER_STATUSES = ['PENDIENTE', 'RECIBIDO', 'REVISADO'] as const;
const MEDICATION_ROUTES = [
  'ORAL',
  'IV',
  'IM',
  'SC',
  'TOPICA',
  'INHALATORIA',
  'RECTAL',
  'SUBLINGUAL',
  'OFTALMICA',
  'OTRA',
] as const;

export const REVIEW_NOTE_MIN_LENGTH = 10;

export function sanitizeText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('La sección contiene campos de texto inválidos');
  }

  const sanitized = sanitizeClinicalText(value, maxLength);
  return sanitized || undefined;
}

export function sanitizeTextListField(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const sanitized = sanitizeText(value, maxLength);
  return sanitized === undefined ? undefined : sanitized;
}

export function sanitizeNumericStringField(value: unknown, label: string, min: number, max: number) {
  const sanitized = sanitizeTextListField(value, 32);
  if (sanitized === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(sanitized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${label} debe estar entre ${min} y ${max}`);
  }

  return String(parsed);
}

export function sanitizePressureField(value: unknown) {
  const sanitized = sanitizeTextListField(value, 16);
  if (sanitized === undefined) {
    return undefined;
  }

  if (!/^\d{2,3}\/\d{2,3}$/.test(sanitized)) {
    throw new BadRequestException('La presión arterial debe tener formato 120/80');
  }

  return sanitized;
}

export function sanitizeRequiredWorkflowNote(value: unknown, label: string, minLength: number, maxLength: number) {
  const sanitized = sanitizeText(value, maxLength);
  if (!sanitized || sanitized.length < minLength) {
    throw new BadRequestException(`${label} debe tener al menos ${minLength} caracteres`);
  }

  return sanitized;
}

export function sanitizeStructuredMedication(item: unknown, index: number) {
  if (typeof item !== 'object' || item === null) {
    throw new BadRequestException(`Medicamento estructurado #${index + 1} inválido`);
  }

  const record = item as Record<string, unknown>;
  const id = sanitizeText(record.id, 100);
  if (!id) {
    throw new BadRequestException(`Medicamento estructurado #${index + 1} requiere id`);
  }

  const nombre = sanitizeTextListField(record.nombre, 200);
  const activeIngredient = sanitizeTextListField(record.activeIngredient, 200);
  const dosis = sanitizeTextListField(record.dosis, 120);
  const via = (() => {
    if (record.via === undefined || record.via === null || record.via === '') {
      return undefined;
    }

    if (
      typeof record.via !== 'string' ||
      !MEDICATION_ROUTES.includes(record.via as (typeof MEDICATION_ROUTES)[number])
    ) {
      throw new BadRequestException(`La vía del medicamento estructurado #${index + 1} no es válida`);
    }

    return record.via;
  })();
  const frecuencia = sanitizeTextListField(record.frecuencia, 120);
  const duracion = sanitizeTextListField(record.duracion, 120);
  const indicacion = sanitizeTextListField(record.indicacion, 400);
  const sospechaId = sanitizeText(record.sospechaId, 100);

  if (!nombre && !activeIngredient && !dosis && !via && !frecuencia && !duracion && !indicacion) {
    return null;
  }

  return {
    id,
    ...(nombre !== undefined ? { nombre } : {}),
    ...(activeIngredient !== undefined ? { activeIngredient } : {}),
    ...(dosis !== undefined ? { dosis } : {}),
    ...(via !== undefined ? { via } : {}),
    ...(frecuencia !== undefined ? { frecuencia } : {}),
    ...(duracion !== undefined ? { duracion } : {}),
    ...(indicacion !== undefined ? { indicacion } : {}),
    ...(sospechaId !== undefined ? { sospechaId } : {}),
  };
}

export function sanitizeStructuredOrder(item: unknown, index: number, label: 'examen' | 'derivación') {
  if (typeof item !== 'object' || item === null) {
    throw new BadRequestException(`${label} estructurado #${index + 1} inválido`);
  }

  const record = item as Record<string, unknown>;
  const id = sanitizeText(record.id, 100);
  if (!id) {
    throw new BadRequestException(`${label} estructurado #${index + 1} requiere id`);
  }

  const nombre = sanitizeTextListField(record.nombre, 200);
  const indicacion = sanitizeTextListField(record.indicacion, 400);
  const resultado = sanitizeTextListField(record.resultado, 1000);
  const sospechaId = sanitizeText(record.sospechaId, 100);
  const estado = (() => {
    if (record.estado === undefined || record.estado === null || record.estado === '') {
      return 'PENDIENTE';
    }

    if (
      typeof record.estado !== 'string' ||
      !ORDER_STATUSES.includes(record.estado as (typeof ORDER_STATUSES)[number])
    ) {
      throw new BadRequestException(`El estado del ${label} estructurado #${index + 1} no es válido`);
    }

    return record.estado;
  })();

  if (!nombre && !indicacion && !resultado) {
    return null;
  }

  return {
    id,
    ...(nombre !== undefined ? { nombre } : {}),
    ...(indicacion !== undefined ? { indicacion } : {}),
    estado,
    ...(resultado !== undefined ? { resultado } : {}),
    ...(sospechaId !== undefined ? { sospechaId } : {}),
  };
}
