import {
  getEncounterActionBlockReason,
  getEncounterClinicalOutputBlockReason,
  getEncounterStatusOutputBlockReason,
  isEncounterClinicalOutputActionBlocked,
} from '@/lib/clinical-output';
import type { EncounterClinicalOutputBlock } from '@/types';

describe('clinical-output helpers', () => {
  const block: EncounterClinicalOutputBlock = {
    completenessStatus: 'PENDIENTE_VERIFICACION',
    missingFields: [],
    blockedActions: ['COMPLETE_ENCOUNTER', 'EXPORT_OFFICIAL_DOCUMENTS', 'PRINT_CLINICAL_RECORD'],
    reason: 'La ficha maestra del paciente está pendiente de verificación médica.',
  };

  it('returns true when the action is blocked', () => {
    expect(isEncounterClinicalOutputActionBlocked(block, 'COMPLETE_ENCOUNTER')).toBe(true);
  });

  it('returns the block reason only for blocked actions', () => {
    expect(getEncounterClinicalOutputBlockReason(block, 'EXPORT_OFFICIAL_DOCUMENTS')).toBe(block.reason);
    expect(getEncounterClinicalOutputBlockReason(null, 'PRINT_CLINICAL_RECORD')).toBeNull();
  });

  it('blocks official outputs while the encounter is not completed or signed', () => {
    expect(getEncounterStatusOutputBlockReason('EN_PROGRESO', 'EXPORT_OFFICIAL_DOCUMENTS')).toContain(
      'completada o firmada',
    );
    expect(getEncounterStatusOutputBlockReason('FIRMADO', 'PRINT_CLINICAL_RECORD')).toBeNull();
  });

  it('prioritizes encounter status restrictions over patient-completeness reasons for official outputs', () => {
    expect(getEncounterActionBlockReason('EN_PROGRESO', block, 'PRINT_CLINICAL_RECORD')).toContain(
      'completada o firmada',
    );
  });
});
