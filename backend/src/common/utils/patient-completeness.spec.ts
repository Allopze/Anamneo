import { BadRequestException } from '@nestjs/common';
import {
  assertEncounterClinicalOutputAllowed,
  getEncounterClinicalOutputBlock,
  getEncounterClinicalOutputBlockMessage,
  isEncounterClinicalOutputActionBlocked,
} from './patient-completeness';

describe('patient-completeness clinical output policy', () => {
  it('returns the configured blocked actions for incomplete records', () => {
    const block = getEncounterClinicalOutputBlock({
      completenessStatus: 'INCOMPLETA',
      rut: null,
      rutExempt: false,
      rutExemptReason: null,
      edad: null,
      sexo: null,
      prevision: null,
    });

    expect(block).toMatchObject({
      completenessStatus: 'INCOMPLETA',
      blockedActions: [
        'COMPLETE_ENCOUNTER',
        'EXPORT_OFFICIAL_DOCUMENTS',
        'PRINT_CLINICAL_RECORD',
      ],
    });
  });

  it('builds an action-specific message when a blocked action is requested', () => {
    const block = getEncounterClinicalOutputBlock({
      completenessStatus: 'PENDIENTE_VERIFICACION',
      rut: '11.111.111-1',
      rutExempt: false,
      rutExemptReason: null,
      edad: 30,
      sexo: 'FEMENINO',
      prevision: 'FONASA',
    });

    expect(block).not.toBeNull();
    expect(getEncounterClinicalOutputBlockMessage(block!, 'EXPORT_OFFICIAL_DOCUMENTS')).toContain(
      'emitir documentos clínicos oficiales',
    );
    expect(isEncounterClinicalOutputActionBlocked(block, 'EXPORT_OFFICIAL_DOCUMENTS')).toBe(true);
  });

  it('throws a bad request when a blocked action is asserted', () => {
    expect(() =>
      assertEncounterClinicalOutputAllowed(
        {
          completenessStatus: 'PENDIENTE_VERIFICACION',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          edad: 30,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
        },
        'COMPLETE_ENCOUNTER',
      ),
    ).toThrow(BadRequestException);
  });

  it('allows clinical outputs when the patient record is verified', () => {
    expect(() =>
      assertEncounterClinicalOutputAllowed(
        {
          completenessStatus: 'VERIFICADA',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          edad: 30,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
        },
        'PRINT_CLINICAL_RECORD',
      ),
    ).not.toThrow();
  });
});