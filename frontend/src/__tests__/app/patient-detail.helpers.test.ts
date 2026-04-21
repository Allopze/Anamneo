import type { Patient } from '@/types';
import { downloadPatientExportBundle } from '@/app/(dashboard)/pacientes/[id]/patient-detail.helpers';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe('patient detail export helpers', () => {
  const patient = {
    id: 'patient-1',
    nombre: 'María Eugenia Flores Tapia',
  } as Patient;

  const createObjectUrlSpy = jest.fn(() => 'blob:bundle');
  const revokeObjectUrlSpy = jest.fn();
  const clickSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({
      data: new Blob(['bundle']),
      headers: {
        'content-disposition': 'attachment; filename="Maria Flores - Paquete clinico - 2026-04-21.zip"',
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
    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        return {
          click: clickSpy,
          remove: jest.fn(),
          href: '',
          download: '',
        } as unknown as HTMLElement;
      }

      return document.createElement(tagName);
    }) as typeof document.createElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads the patient clinical bundle using the backend filename when available', async () => {
    await downloadPatientExportBundle('patient-1', patient);

    expect(apiGetMock).toHaveBeenCalledWith('/patients/patient-1/export/bundle', { responseType: 'blob' });
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:bundle');
  });
});