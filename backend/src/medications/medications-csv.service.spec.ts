import { BadRequestException } from '@nestjs/common';
import { MedicationsCsvService } from './medications-csv.service';

describe('MedicationsCsvService', () => {
  let service: MedicationsCsvService;

  const mockPrisma = {
    medicationCatalog: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicationsCsvService(mockPrisma as never, mockAuditService as never);
  });

  it('builds a preview from csv headers in spanish and collapses normalized duplicates', async () => {
    mockPrisma.medicationCatalog.findMany.mockResolvedValue([
      {
        id: 'med-active',
        name: 'Omeprazol',
        activeIngredient: 'Omeprazol',
        active: true,
      },
      {
        id: 'med-inactive',
        name: 'Aspirina',
        activeIngredient: 'Ácido acetilsalicílico',
        active: false,
      },
    ]);

    const result = await service.previewGlobalCsv(
      Buffer.from(
        [
          'nombre,principioactivo',
          'Omeprazol,Omeprazol',
          'ASPIRINA,Ácido acetilsalicílico',
          'omeprazól,Omeprazol magnésico',
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
    expect(result.preview[0]).toMatchObject({
      name: 'omeprazól',
      activeIngredient: 'Omeprazol magnésico',
      action: 'UPDATE',
    });
    expect(result.preview[1]).toMatchObject({
      name: 'ASPIRINA',
      action: 'REACTIVATE',
    });
  });

  it('imports csv rows and updates or reactivates existing medications', async () => {
    mockPrisma.medicationCatalog.findMany.mockResolvedValue([
      {
        id: 'med-active',
        name: 'Omeprazol',
        activeIngredient: 'Omeprazol',
        active: true,
      },
      {
        id: 'med-inactive',
        name: 'Aspirina',
        activeIngredient: 'Ácido acetilsalicílico',
        active: false,
      },
    ]);
    mockPrisma.medicationCatalog.update.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      }),
    );
    mockPrisma.medicationCatalog.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: `created-${String(data.name)}`,
        ...data,
      }),
    );

    const result = await service.importGlobalCsv(
      Buffer.from(
        [
          'name,activeIngredient',
          'Omeprazol,Omeprazol magnésico',
          'Aspirina,Ácido acetilsalicílico',
          'Paracetamol,Paracetamol',
        ].join('\n'),
      ),
      'admin-user-id',
    );

    expect(result).toEqual({
      created: 1,
      updated: 1,
      reactivated: 1,
      total: 3,
      duplicateRows: 0,
    });
    expect(mockPrisma.medicationCatalog.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'med-active' },
        data: expect.objectContaining({
          normalizedName: 'omeprazol',
          activeIngredient: 'Omeprazol magnésico',
          active: true,
        }),
      }),
    );
    expect(mockPrisma.medicationCatalog.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'med-inactive' },
        data: expect.objectContaining({
          normalizedName: 'aspirina',
          activeIngredient: 'Ácido acetilsalicílico',
          active: true,
        }),
      }),
    );
    expect(mockPrisma.medicationCatalog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Paracetamol',
          normalizedName: 'paracetamol',
          activeIngredient: 'Paracetamol',
        }),
      }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'MedicationCatalog',
        entityId: 'global-csv',
        userId: 'admin-user-id',
        action: 'UPDATE',
        reason: 'MEDICATION_CSV_IMPORTED',
      }),
    );
  });

  it('rejects invalid rows before touching persistence', async () => {
    await expect(
      service.importGlobalCsv(Buffer.from(['name,activeIngredient', 'ibuprofeno,'].join('\n'))),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.medicationCatalog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockAuditService.log).not.toHaveBeenCalled();
  });
});