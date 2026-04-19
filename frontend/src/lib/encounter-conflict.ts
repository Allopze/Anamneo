export interface EncounterConflictPreviewItem {
  fieldLabel: string;
  serverValue: string;
  localValue: string;
}

function formatConflictValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Sin valor';
  }

  if (typeof value === 'string') {
    return value.trim() || 'Sin valor';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Sin valor';
    }

    return value
      .map((item) => formatConflictValue(item))
      .join(', ')
      .slice(0, 160);
  }

  try {
    return JSON.stringify(value).slice(0, 160);
  } catch {
    return 'Contenido no serializable';
  }
}

function humanizeSegment(segment: string) {
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function collectComparableFields(
  value: unknown,
  output: Map<string, string>,
  prefix = '',
  depth = 0,
) {
  if (depth >= 2 || value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    output.set(prefix || 'contenido', formatConflictValue(value));
    return;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    output.set(prefix || 'contenido', 'Sin valor');
    return;
  }

  entries.forEach(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    collectComparableFields(nestedValue, output, nextPrefix, depth + 1);
  });
}

export function buildEncounterConflictPreview(
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  limit = 4,
) {
  const localFields = new Map<string, string>();
  const serverFields = new Map<string, string>();

  collectComparableFields(localData, localFields);
  collectComparableFields(serverData, serverFields);

  const fieldKeys = [...new Set([...serverFields.keys(), ...localFields.keys()])];
  const differences = fieldKeys
    .map((fieldKey) => {
      const serverValue = serverFields.get(fieldKey) ?? 'Sin valor';
      const localValue = localFields.get(fieldKey) ?? 'Sin valor';

      if (serverValue === localValue) {
        return null;
      }

      return {
        fieldLabel: fieldKey
          .split('.')
          .map((segment) => humanizeSegment(segment))
          .join(' / '),
        serverValue,
        localValue,
      } satisfies EncounterConflictPreviewItem;
    })
    .filter((item): item is EncounterConflictPreviewItem => item !== null);

  return {
    totalDifferences: differences.length,
    items: differences.slice(0, limit),
  };
}
