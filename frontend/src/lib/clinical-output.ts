import type { Encounter, EncounterClinicalOutputAction, EncounterClinicalOutputBlock } from '@/types';

const OFFICIAL_OUTPUT_ALLOWED_STATUSES = new Set<Encounter['status']>(['COMPLETADO', 'FIRMADO']);

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

export function getEncounterStatusOutputBlockReason(
  status: Encounter['status'] | null | undefined,
  action: Extract<EncounterClinicalOutputAction, 'EXPORT_OFFICIAL_DOCUMENTS' | 'PRINT_CLINICAL_RECORD'>,
) {
  if (!status || OFFICIAL_OUTPUT_ALLOWED_STATUSES.has(status)) {
    return null;
  }

  if (action === 'PRINT_CLINICAL_RECORD') {
    return 'La ficha clínica solo puede imprimirse cuando la atención está completada o firmada.';
  }

  return 'Los documentos clínicos oficiales solo pueden emitirse cuando la atención está completada o firmada.';
}

export function getEncounterActionBlockReason(
  status: Encounter['status'] | null | undefined,
  block: EncounterClinicalOutputBlock | null | undefined,
  action: Extract<EncounterClinicalOutputAction, 'EXPORT_OFFICIAL_DOCUMENTS' | 'PRINT_CLINICAL_RECORD'>,
) {
  return getEncounterStatusOutputBlockReason(status, action) ?? getEncounterClinicalOutputBlockReason(block, action);
}

export function getFocusedEncounterDocumentBlockReason(
  block: EncounterClinicalOutputBlock | null | undefined,
) {
  return getEncounterClinicalOutputBlockReason(block, 'EXPORT_OFFICIAL_DOCUMENTS');
}
