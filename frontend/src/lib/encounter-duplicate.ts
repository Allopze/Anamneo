import type { Encounter } from '@/types';

const DUPLICATE_SOURCE_ALLOWED_STATUSES = new Set<Encounter['status']>(['COMPLETADO', 'FIRMADO']);

export const DUPLICATE_ENCOUNTER_ACTION_TITLE =
  'Crear un nuevo seguimiento limpio usando esta atención como referencia';

export const DUPLICATE_ENCOUNTER_CREATED_MESSAGE = 'Seguimiento creado';

export function canUseEncounterAsDuplicateSource(status: Encounter['status'] | null | undefined) {
  return Boolean(status && DUPLICATE_SOURCE_ALLOWED_STATUSES.has(status));
}

export function getDuplicateEncounterActionLabel(isPending: boolean) {
  return isPending ? 'Preparando seguimiento…' : 'Nuevo seguimiento';
}