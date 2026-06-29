import { ConditionsService } from './conditions.service';
import * as localQueries from './conditions-local-queries';

describe('ConditionsService.count', () => {
  it('uses a direct catalog count for admin users', async () => {
    const prisma = {
      conditionCatalog: {
        count: jest.fn().mockResolvedValue(12),
      },
    } as any;
    const service = new ConditionsService(prisma, {} as any);

    await expect(service.count({ id: 'admin-1', role: 'ADMIN', isAdmin: true } as any)).resolves.toEqual({ count: 12 });
    expect(prisma.conditionCatalog.count).toHaveBeenCalledWith();
  });

  it('uses the merged count helper for non-admin users', async () => {
    const countMergedConditions = jest.spyOn(localQueries, 'countMergedConditions').mockResolvedValue(9);
    const service = new ConditionsService({} as any, {} as any);
    const user = { id: 'med-1', role: 'MEDICO', isAdmin: false } as any;

    await expect(service.count(user)).resolves.toEqual({ count: 9 });
    expect(countMergedConditions).toHaveBeenCalledWith(expect.anything(), user);

    countMergedConditions.mockRestore();
  });
});
