import { Logger } from '@nestjs/common';
import { decryptField } from './field-crypto';

const logger = new Logger('parseStoredJson');

export function parseStoredJson<T = Record<string, unknown>>(value: unknown, fallback?: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      const raw = value.startsWith('enc:') ? decryptField(value) : value;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn(
        `Failed to parse/decrypt stored JSON (length=${value.length}, encrypted=${value.startsWith('enc:')}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const fb = (fallback ?? ({} as T));
  if (typeof fb === 'object' && fb !== null) {
    return { ...fb, _parseError: true } as T;
  }
  return fb;
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
