import { downloadClinicalAnalyticsCasesCsv } from '@/app/(dashboard)/analitica-clinica/casos/analytics-cases-export';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe('clinical-analytics-cases-export helper', () => {
  const createObjectUrlSpy = jest.fn(() => 'blob:csv');
  const revokeObjectUrlSpy = jest.fn();
  const clickSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({
      data: new Blob(['csv']),
      headers: {
        'content-disposition': 'attachment; filename="casos_analiticos_2026-04-22.csv"',
      },
    });

    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectUrlSpy,
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads the analytics cases csv using the backend filename when available', async () => {
    await downloadClinicalAnalyticsCasesCsv(
      {
        condition: 'dolor abdominal',
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: '30',
        limit: '10',
      },
      { type: 'MEDICATION', value: 'Paracetamol' },
    );

    expect(apiGetMock).toHaveBeenCalledWith(
      '/analytics/clinical/cases/export/csv?condition=dolor+abdominal&source=ANY&fromDate=2026-04-01&toDate=2026-04-20&followUpDays=30&focusType=MEDICATION&focusValue=Paracetamol',
      { responseType: 'blob' },
    );
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:csv');
  });
});