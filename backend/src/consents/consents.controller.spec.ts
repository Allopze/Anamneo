import { ConsentsController } from './consents.controller';

describe('ConsentsController', () => {
  const user = { id: 'med-1', role: 'MEDICO' } as never;

  it('keeps the legacy patient response shape when withMeta is omitted', async () => {
    const consentsService = {
      findByPatient: jest.fn().mockResolvedValue([{ id: 'consent-1' }]),
    };
    const controller = new ConsentsController(consentsService as never);

    const result = await controller.findByPatient('pat-1', user, '5');

    expect(result).toEqual([{ id: 'consent-1' }]);
    expect(consentsService.findByPatient).toHaveBeenCalledWith(
      'pat-1',
      user,
      {
        revokedLimit: 5,
      },
    );
  });

  it('passes withMeta through for patient consent pagination metadata', async () => {
    const response = {
      data: [{ id: 'consent-1' }],
      meta: { revokedHasMore: false },
    };
    const consentsService = {
      findByPatient: jest.fn().mockResolvedValue(response),
    };
    const controller = new ConsentsController(consentsService as never);

    const result = await controller.findByPatient('pat-1', user, '5', 'true');

    expect(result).toBe(response);
    expect(consentsService.findByPatient).toHaveBeenCalledWith(
      'pat-1',
      user,
      {
        revokedLimit: 5,
        withMeta: true,
      },
    );
  });
});
