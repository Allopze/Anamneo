import { buildPatientLegalStatus } from '../../../shared/patient-legal-status';

describe('buildPatientLegalStatus', () => {
  it('permite mutaciones clinicas cuando no hay bloqueo temporal', () => {
    expect(buildPatientLegalStatus({ blockedAt: null })).toMatchObject({
      canReceiveCare: true,
      canCreateEncounter: true,
      canEditEncounter: true,
      canUploadAttachment: true,
      legalBlockReason: null,
      requiredActions: [],
    });
  });

  it('bloquea mutaciones clinicas y expone accion requerida durante bloqueo temporal', () => {
    expect(buildPatientLegalStatus({
      blockedAt: '2026-05-24T10:00:00.000Z',
      blockedReason: 'Solicitud del titular',
    })).toMatchObject({
      canReceiveCare: false,
      canCreateEncounter: false,
      canEditEncounter: false,
      canUploadAttachment: false,
      canRegisterClinicalConsent: false,
      canRegisterDataProcessingConsent: false,
      legalBlockReason: 'Solicitud del titular',
      requiredActions: [
        expect.objectContaining({
          code: 'LIFT_DATA_PROCESSING_BLOCK',
          severity: 'blocking',
        }),
      ],
    });
  });

  it('mantiene advertencia para oposiciones no asistenciales', () => {
    expect(buildPatientLegalStatus({
      processingObjections: { ANALITICA_INTERNA: true },
    }).requiredActions).toEqual([
      expect.objectContaining({
        code: 'REVIEW_PROCESSING_OBJECTIONS',
        severity: 'warning',
      }),
    ]);
  });
});
