import { countMergedConditions } from './conditions-local-queries';

describe('countMergedConditions', () => {
  it('counts active globals minus excluded overrides plus local-only active conditions', async () => {
    const prisma = {
      conditionCatalog: {
        count: jest.fn().mockResolvedValue(10),
      },
      conditionCatalogLocal: {
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3),
      },
    } as any;

    const count = await countMergedConditions(prisma, {
      id: 'med-1',
      role: 'MEDICO',
      isAdmin: false,
    } as any);

    expect(count).toBe(11);
    expect(prisma.conditionCatalog.count).toHaveBeenCalledWith({ where: { active: true } });
    expect(prisma.conditionCatalogLocal.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          medicoId: 'med-1',
          baseConditionId: { not: null },
          OR: [{ hidden: true }, { active: false }],
          baseCondition: { is: { active: true } },
        }),
      }),
    );
    expect(prisma.conditionCatalogLocal.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          medicoId: 'med-1',
          baseConditionId: null,
          active: true,
          hidden: false,
        }),
      }),
    );
  });
});
