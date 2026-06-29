import { AlertsController } from './alerts.controller';

describe('AlertsController', () => {
  const user = { id: 'med-1', role: 'MEDICO' } as never;

  it('keeps the legacy patient response shape when withMeta is omitted', async () => {
    const alertsService = {
      findByPatient: jest.fn().mockResolvedValue([{ id: 'alert-1' }]),
    };
    const controller = new AlertsController(alertsService as never);

    const result = await controller.findByPatient('pat-1', user, 'true', '5');

    expect(result).toEqual([{ id: 'alert-1' }]);
    expect(alertsService.findByPatient).toHaveBeenCalledWith(
      'pat-1',
      user,
      {
        includeAcknowledged: true,
        acknowledgedLimit: 5,
      },
    );
  });

  it('passes withMeta through for patient alert pagination metadata', async () => {
    const response = {
      data: [{ id: 'alert-1' }],
      meta: { acknowledgedHasMore: false },
    };
    const alertsService = {
      findByPatient: jest.fn().mockResolvedValue(response),
    };
    const controller = new AlertsController(alertsService as never);

    const result = await controller.findByPatient('pat-1', user, 'true', '5', 'true');

    expect(result).toBe(response);
    expect(alertsService.findByPatient).toHaveBeenCalledWith(
      'pat-1',
      user,
      {
        includeAcknowledged: true,
        acknowledgedLimit: 5,
        withMeta: true,
      },
    );
  });
});
