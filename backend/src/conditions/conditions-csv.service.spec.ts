import { BadRequestException } from '@nestjs/common';
import { ConditionsCsvService } from './conditions-csv.service';

describe('ConditionsCsvService', () => {
  let service: ConditionsCsvService;

  const mockPrisma = {
    conditionCatalog: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };

  const mockSimilarityService = {
    buildIndex: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConditionsCsvService(mockPrisma as never, mockSimilarityService as never, mockAuditService as never);
  });

  it('builds a preview from header-based CSV and merges normalized duplicates', async () => {
    mockPrisma.conditionCatalog.findMany.mockResolvedValue([
      {
        id: 'condition-active',
        name: 'Hipertensión',
        synonyms: '["hta"]',
        tags: '["cardio"]',
        active: true,
      },
      {
        id: 'condition-inactive',
        name: 'Migraña',
        synonyms: '[]',
        tags: '[]',
        active: false,
      },
    ]);

    const result = await service.previewGlobalCsv(
      Buffer.from(
        [
          'name,synonyms,tags',
          'Hipertension,"hta|presión, alta",cardio',
          'Migraña,,neuro',
          'hipertensión,control presión,riesgo',
        ].join('\n'),
      ),
    );

    expect(result.detectedFormat).toBe('HEADER');
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.importableRows).toBe(2);
    expect(result.duplicateRows).toBe(1);
    expect(result.createCount).toBe(0);
    expect(result.updateCount).toBe(1);
    expect(result.reactivateCount).toBe(1);
    expect(result.invalidRows).toEqual([]);
    expect(result.preview[0].synonyms).toEqual(
      expect.arrayContaining(['hta', 'presión, alta', 'control presión']),
    );
    expect(result.preview[0].tags).toEqual(expect.arrayContaining(['cardio', 'riesgo']));
    expect(result.preview[1]).toMatchObject({
      name: 'Migraña',
      action: 'REACTIVATE',
      tags: ['neuro'],
    });
  });

  it('imports CSV rows and merges synonyms and tags with existing conditions', async () => {
    mockPrisma.conditionCatalog.findMany.mockResolvedValue([
      {
        id: 'condition-active',
        name: 'Hipertensión',
        synonyms: '["hta"]',
        tags: '["cardio"]',
        active: true,
      },
      {
        id: 'condition-inactive',
        name: 'Migraña',
        synonyms: '[]',
        tags: '[]',
        active: false,
      },
    ]);
    mockPrisma.conditionCatalog.update.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      }),
    );
    mockPrisma.conditionCatalog.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: `created-${String(data.name)}`,
        ...data,
      }),
    );

    const result = await service.importGlobalCsv(
      Buffer.from(
        [
          'name,synonyms,tags',
          'Hipertensión,presión alta,seguimiento',
          'Migraña,,neurologia',
        ].join('\n'),
      ),
      'admin-user-id',
    );

    expect(result).toEqual({
      created: 0,
      updated: 1,
      reactivated: 1,
      total: 2,
      duplicateRows: 0,
    });
    expect(mockPrisma.conditionCatalog.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'condition-active' },
        data: expect.objectContaining({
          normalizedName: 'hipertension',
          synonyms: JSON.stringify(['hta', 'presión alta']),
          tags: JSON.stringify(['cardio', 'seguimiento']),
          active: true,
        }),
      }),
    );
    expect(mockPrisma.conditionCatalog.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'condition-inactive' },
        data: expect.objectContaining({
          normalizedName: 'migrana',
          tags: JSON.stringify(['neurologia']),
          active: true,
        }),
      }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockSimilarityService.buildIndex).toHaveBeenCalledTimes(1);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ConditionCatalog',
        entityId: 'global-csv',
        userId: 'admin-user-id',
        action: 'UPDATE',
        reason: 'CONDITION_CSV_IMPORTED',
      }),
    );
  });

  it('rejects invalid rows before touching persistence', async () => {
    await expect(
      service.importGlobalCsv(Buffer.from(['name,synonyms', ',hta'].join('\n'))),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.conditionCatalog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockAuditService.log).not.toHaveBeenCalled();
  });
});