import { ConditionsController } from './conditions.controller';

describe('ConditionsController', () => {
  it('keeps /conditions/count as a thin service-backed contract', async () => {
    const conditionsService = {
      count: jest.fn().mockResolvedValue({ count: 42 }),
    } as any;
    const controller = new ConditionsController(conditionsService, {} as any);
    const user = { id: 'med-1', role: 'MEDICO', isAdmin: false } as any;

    await expect(controller.count(user)).resolves.toEqual({ count: 42 });
    expect(conditionsService.count).toHaveBeenCalledWith(user);
  });
});
