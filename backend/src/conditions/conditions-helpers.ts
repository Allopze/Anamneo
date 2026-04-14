import { ForbiddenException } from '@nestjs/common';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';

export function normalizeConditionName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sanitizeStringArray(values?: string[]): string[] {
  return (values || []).map((value) => value.trim()).filter(Boolean);
}

export function mergeUniqueStrings(existing: string[], incoming: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of [...existing, ...incoming]) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      continue;
    }

    const key = normalizeConditionName(trimmedValue);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(trimmedValue);
  }

  return merged;
}

export function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toConditionResponse(
  condition: { id: string; name: string; synonyms?: unknown; tags?: unknown; active: boolean },
  scope: 'GLOBAL' | 'LOCAL',
  baseConditionId?: string | null,
) {
  return {
    id: condition.id,
    name: condition.name,
    synonyms: parseStringArray(condition.synonyms),
    tags: parseStringArray(condition.tags),
    active: condition.active,
    scope,
    baseConditionId: baseConditionId ?? null,
  };
}

export function getInstanceId(user: CurrentUserData): string {
  if (!user) {
    throw new ForbiddenException('Usuario no autenticado');
  }
  if (user.role === 'MEDICO') return user.id;
  if (user.role === 'ASISTENTE' && user.medicoId) return user.medicoId;
  throw new ForbiddenException('No tiene una instancia asignada');
}
