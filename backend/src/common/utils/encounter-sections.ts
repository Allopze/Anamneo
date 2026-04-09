import { decryptField } from './field-crypto';

export function parseStoredJson<T = Record<string, unknown>>(value: unknown, fallback?: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      const raw = value.startsWith('enc:') ? decryptField(value) : value;
      return JSON.parse(raw) as T;
    } catch {
      // Ignore malformed legacy payloads and fall through to fallback.
    }
  }

  return (fallback ?? ({} as T));
}

export function parseEncounterSection(section: { data: unknown }) {
  return {
    ...section,
    data: parseStoredJson(section.data),
  };
}

export function parseEncounterSections<T extends { sections?: Array<{ data: unknown }> }>(entity: T): T {
  if (!entity.sections) {
    return entity;
  }

  return {
    ...entity,
    sections: entity.sections.map((section) => parseEncounterSection(section)),
  };
}
