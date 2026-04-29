import { fetchClinicalSearchResults } from '@/lib/clinical-search';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('fetchClinicalSearchResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no results for an empty query without calling the API', async () => {
    await expect(fetchClinicalSearchResults('   ')).resolves.toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('normalizes patient and encounter results', async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'patient-1', nombre: 'Ana Perez', rut: '11.111.111-1' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'enc-1',
              status: 'EN_PROGRESO',
              createdAt: '2026-04-19T10:00:00.000Z',
              patient: { nombre: 'Ana Perez' },
            },
          ],
        },
      });

    const results = await fetchClinicalSearchResults('ana');

    expect(results).toEqual([
      {
        id: 'patient-1',
        type: 'patient',
        title: 'Ana Perez',
        subtitle: '11.111.111-1',
        href: '/pacientes/patient-1',
      },
      expect.objectContaining({
        id: 'enc-1',
        type: 'encounter',
        title: 'Ana Perez',
        href: '/atenciones/enc-1',
      }),
    ]);
  });

  it('keeps fulfilled partial results when one endpoint fails', async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'patient-1', nombre: 'Ana Perez', rut: null }],
        },
      })
      .mockRejectedValueOnce(new Error('encounters down'));

    await expect(fetchClinicalSearchResults('ana')).resolves.toEqual([
      {
        id: 'patient-1',
        type: 'patient',
        title: 'Ana Perez',
        subtitle: 'Sin RUT',
        href: '/pacientes/patient-1',
      },
    ]);
  });
});
