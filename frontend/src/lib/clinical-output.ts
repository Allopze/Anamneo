import type { EncounterClinicalOutputAction, EncounterClinicalOutputBlock } from '@/types';

export function isEncounterClinicalOutputActionBlocked(
  block: EncounterClinicalOutputBlock | null | undefined,
  action: EncounterClinicalOutputAction,
) {
  return Boolean(block?.blockedActions.includes(action));
}

export function getEncounterClinicalOutputBlockReason(
  block: EncounterClinicalOutputBlock | null | undefined,
  action: EncounterClinicalOutputAction,
) {
  if (!isEncounterClinicalOutputActionBlocked(block, action)) {
    return null;
  }

  return block!.reason;
}