import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  reconcileEncounterIdentificationSection,
  updateEncounterSectionMutation,
} from './encounters-section-mutations';
import {
  matchesCurrentPatientSnapshot,
  sanitizeSectionPayload,
  serializeSectionData,
  summarizeSectionAuditData,
  VITAL_SIGNS_ALERT_GENERATION_WARNING,
} from './encounters-sanitize';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';

jest.mock('./encounters-sanitize', () => ({
  IDENTIFICATION_SNAPSHOT_FIELD_META: [
    { key: 'nombre', label: 'nombre' },
    { key: 'edad', label: 'edad' },
  ],
  REQUIRED_SEMANTIC_SECTIONS: [
    'MOTIVO_CONSULTA',
    'EXAMEN_FISICO',
    'SOSPECHA_DIAGNOSTICA',
    'TRATAMIENTO',
  ],
  VITAL_SIGNS_ALERT_GENERATION_WARNING:
    'La seccion se guardo, pero no se pudo completar la verificacion automatica de alertas por signos vitales.',
  buildIdentificationSnapshotFromPatient: jest.fn(() => ({ nombre: 'Paciente Demo', edad: 34 })),
  buildAnamnesisRemotaSnapshotFromHistory: jest.fn(() => ({ readonly: true })),
  matchesCurrentPatientSnapshot: jest.fn(() => true),
  sanitizeSectionPayload: jest.fn((_sectionKey, data) => data),
  serializeSectionData: jest.fn((data) => JSON.stringify(data)),
  summarizeSectionAuditData: jest.fn((sectionKey, _data, completed) => ({
    sectionKey,
    completed,
    redacted: true,
  })),
}));

jest.mock('../common/utils/encounter-section-compat', () => ({
  formatEncounterSectionForRead: jest.fn(() => ({ data: { normalized: true }, schemaVersion: 1 })),
}));

describe('encounters-section-mutations', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (matchesCurrentPatientSnapshot as jest.Mock).mockReturnValue(true);
  });

  it('reconciles identification snapshot and logs the update', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          patient: { id: 'pat-1', nombre: 'Paciente Demo', edad: 34 },
          sections: [
            { id: 'sec-ident', sectionKey: 'IDENTIFICACION' },
          ],
        }),
      },
      encounterSection: {
        update: jest.fn().mockResolvedValue({
          id: 'sec-ident',
          encounterId: 'enc-1',
          sectionKey: 'IDENTIFICACION',
          completed: false,
          notApplicable: false,
          updatedAt: new Date('2026-04-16T00:00:00.000Z'),
          schemaVersion: 1,
          data: '{"nombre":"Paciente Demo"}',
        }),
      },
    };

    const result = await reconcileEncounterIdentificationSection({
      prisma: prisma as never,
      auditService: auditService as never,
      encounterId: 'enc-1',
      user: {
        id: 'med-1',
        role: 'MEDICO',
        isAdmin: false,
      },
    });

    expect(prisma.encounterSection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sec-ident' },
        data: expect.objectContaining({
          data: expect.any(String),
        }),
      }),
    );
    expect(serializeSectionData).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'EncounterSection',
        entityId: 'sec-ident',
        action: 'UPDATE',
      }),
    );
    expect(formatEncounterSectionForRead).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'sec-ident',
        encounterId: 'enc-1',
        sectionKey: 'IDENTIFICACION',
        data: { normalized: true },
      }),
    );
  });

  it('rejects section updates from users outside medico scope', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-owner',
          status: 'EN_PROGRESO',
          createdById: 'assistant-1',
          patientId: 'pat-1',
          patient: { id: 'pat-1' },
          sections: [{ id: 'sec-1', sectionKey: 'MOTIVO_CONSULTA' }],
        }),
      },
      encounterSection: {
        update: jest.fn(),
      },
    };

    await expect(
      updateEncounterSectionMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        alertsService: { checkVitalSigns: jest.fn() } as never,
        logger: { error: jest.fn() },
        encounterId: 'enc-1',
        sectionKey: 'MOTIVO_CONSULTA',
        dto: { data: { texto: 'Control' } },
        user: {
          id: 'med-2',
          role: 'MEDICO',
          isAdmin: false,
        },
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.encounterSection.update).not.toHaveBeenCalled();
  });

  it('rejects notApplicable for required semantic sections', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          createdById: 'med-1',
          patientId: 'pat-1',
          patient: { id: 'pat-1' },
          sections: [{ id: 'sec-1', sectionKey: 'MOTIVO_CONSULTA' }],
        }),
      },
      encounterSection: {
        update: jest.fn(),
      },
    };

    await expect(
      updateEncounterSectionMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        alertsService: { checkVitalSigns: jest.fn() } as never,
        logger: { error: jest.fn() },
        encounterId: 'enc-1',
        sectionKey: 'MOTIVO_CONSULTA',
        dto: {
          data: { texto: 'Control' },
          notApplicable: true,
          notApplicableReason: 'Motivo no valido para seccion obligatoria',
        },
        user: {
          id: 'med-1',
          role: 'MEDICO',
          isAdmin: false,
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.encounterSection.update).not.toHaveBeenCalled();
  });

  it('returns warning when vital-sign alert generation fails but section saves', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          createdById: 'med-1',
          patientId: 'pat-1',
          patient: { id: 'pat-1' },
          sections: [{ id: 'sec-1', sectionKey: 'EXAMEN_FISICO' }],
        }),
      },
      encounterSection: {
        update: jest.fn().mockResolvedValue({
          id: 'sec-1',
          encounterId: 'enc-1',
          sectionKey: 'EXAMEN_FISICO',
          completed: true,
          notApplicable: false,
          notApplicableReason: null,
          updatedAt: new Date('2026-04-16T01:00:00.000Z'),
          schemaVersion: 1,
          data: '{"signosVitales":{"presionArterial":"180/110"}}',
        }),
      },
    };
    const alertsService = {
      checkVitalSigns: jest.fn().mockRejectedValue(new Error('alert-engine-down')),
    };
    const logger = { error: jest.fn() };

    const result = await updateEncounterSectionMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      alertsService: alertsService as never,
      logger,
      encounterId: 'enc-1',
      sectionKey: 'EXAMEN_FISICO',
      dto: {
        data: {
          signosVitales: {
            presionArterial: '180/110',
          },
        },
        completed: true,
      },
      user: {
        id: 'med-1',
        role: 'MEDICO',
        isAdmin: false,
      },
    });

    expect(sanitizeSectionPayload).toHaveBeenCalledWith(
      'EXAMEN_FISICO',
      expect.objectContaining({
        signosVitales: expect.any(Object),
      }),
    );
    expect(alertsService.checkVitalSigns).toHaveBeenCalledWith(
      'pat-1',
      'enc-1',
      expect.any(Object),
      'med-1',
    );
    expect(logger.error).toHaveBeenCalled();
    expect(summarizeSectionAuditData).toHaveBeenCalled();
    expect(result.warnings).toEqual([VITAL_SIGNS_ALERT_GENERATION_WARNING]);
  });

  it('rejects manual divergence for identification snapshot data', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          createdById: 'med-1',
          patientId: 'pat-1',
          patient: { id: 'pat-1' },
          sections: [{ id: 'sec-ident', sectionKey: 'IDENTIFICACION' }],
        }),
      },
      encounterSection: {
        update: jest.fn(),
      },
    };

    (matchesCurrentPatientSnapshot as jest.Mock).mockReturnValue(false);

    await expect(
      updateEncounterSectionMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        alertsService: { checkVitalSigns: jest.fn() } as never,
        logger: { error: jest.fn() },
        encounterId: 'enc-1',
        sectionKey: 'IDENTIFICACION',
        dto: {
          data: { nombre: 'Cambio manual' },
        },
        user: {
          id: 'med-1',
          role: 'MEDICO',
          isAdmin: false,
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.encounterSection.update).not.toHaveBeenCalled();
  });

  it('rejects stale section saves when baseUpdatedAt no longer matches', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          createdById: 'med-1',
          patientId: 'pat-1',
          patient: { id: 'pat-1' },
          sections: [
            {
              id: 'sec-1',
              sectionKey: 'TRATAMIENTO',
              updatedAt: new Date('2026-04-17T10:00:00.000Z'),
            },
          ],
        }),
      },
      encounterSection: {
        update: jest.fn(),
      },
    };

    await expect(
      updateEncounterSectionMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        alertsService: { checkVitalSigns: jest.fn() } as never,
        logger: { error: jest.fn() },
        encounterId: 'enc-1',
        sectionKey: 'TRATAMIENTO',
        dto: {
          data: { plan: 'Nuevo plan' },
          baseUpdatedAt: '2026-04-17T09:59:00.000Z',
        },
        user: {
          id: 'med-1',
          role: 'MEDICO',
          isAdmin: false,
        },
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.encounterSection.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when reconciling missing encounter', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      encounterSection: {
        update: jest.fn(),
      },
    };

    await expect(
      reconcileEncounterIdentificationSection({
        prisma: prisma as never,
        auditService: auditService as never,
        encounterId: 'missing-encounter',
        user: {
          id: 'med-1',
          role: 'MEDICO',
          isAdmin: false,
        },
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.encounterSection.update).not.toHaveBeenCalled();
  });
});
