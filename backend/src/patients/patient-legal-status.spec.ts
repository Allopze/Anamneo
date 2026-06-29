import { buildPatientLegalStatus } from '../../../shared/patient-legal-status';

describe('buildPatientLegalStatus', () => {
  it('permite mutaciones clinicas cuando no hay bloqueo temporal', () => {
    expect(buildPatientLegalStatus({ blockedAt: null })).toMatchObject({
      canReceiveCare: true,
      canCreateEncounter: true,
      canEditEncounter: true,
      canUploadAttachment: true,
      hasActiveDataProcessingConsent: null,
      dataProcessingConsent: null,
      activeDataRequestCount: 0,
      activeDataRequests: [],
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

  it('advierte cuando falta consentimiento vigente de tratamiento de datos', () => {
    expect(buildPatientLegalStatus({
      hasActiveDataProcessingConsent: false,
    })).toMatchObject({
      canReceiveCare: true,
      hasActiveDataProcessingConsent: false,
      requiredActions: [
        expect.objectContaining({
          code: 'REGISTER_DATA_PROCESSING_CONSENT',
          severity: 'warning',
        }),
      ],
    });
  });

  it('advierte cuando existen solicitudes activas de derechos del titular', () => {
    expect(buildPatientLegalStatus({
      activeDataRequests: [
        {
          id: 'request-1',
          requestType: 'ACCESS',
          status: 'PENDING',
          dueDate: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'request-2',
          requestType: 'RECTIFICATION',
          status: 'IN_REVIEW',
          dueDate: null,
        },
      ],
    })).toMatchObject({
      activeDataRequestCount: 2,
      activeDataRequests: [
        expect.objectContaining({ id: 'request-1', requestType: 'ACCESS' }),
        expect.objectContaining({ id: 'request-2', requestType: 'RECTIFICATION' }),
      ],
      requiredActions: [
        expect.objectContaining({
          code: 'REVIEW_ACTIVE_DATA_REQUESTS',
          severity: 'warning',
        }),
      ],
    });
  });

  it('expone evidencia y version del consentimiento de tratamiento de datos', () => {
    expect(buildPatientLegalStatus({
      hasActiveDataProcessingConsent: true,
      dataProcessingConsent: {
        id: 'consent-1',
        legalDocumentVersion: '2026.05',
        grantedAt: '2026-05-24T12:00:00.000Z',
        evidenceHash: 'hash-evidencia-legal',
      },
    })).toMatchObject({
      hasActiveDataProcessingConsent: true,
      dataProcessingConsent: {
        id: 'consent-1',
        legalDocumentVersion: '2026.05',
        evidenceHash: 'hash-evidencia-legal',
      },
      requiredActions: [],
    });
  });
});
