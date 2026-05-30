import type { Patient } from '@/types';
import {
  downloadPatientExportBundle,
  downloadPatientRegulatoryExport,
} from '@/app/(dashboard)/pacientes/[id]/patient-detail.helpers';

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

  it('downloads the regulatory export ZIP using the backend content-disposition filename', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: new Blob(['regulatory']),
      headers: {
        'content-disposition':
          'attachment; filename="paciente-patient-1-regulatorio-2026-05-30.zip"',
      },
    });

    await downloadPatientRegulatoryExport('patient-1', patient);

    expect(apiGetMock).toHaveBeenCalledWith('/patients/patient-1/export/regulatory', { responseType: 'blob' });
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:bundle');
  });

  it('falls back to a safe patient name when regulatory export has no content-disposition', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: new Blob(['regulatory']),
      headers: {},
    });

    const linkEl = {
      click: clickSpy,
      remove: jest.fn(),
      href: '',
      download: '',
    } as unknown as HTMLAnchorElement;

    jest.spyOn(document, 'createElement').mockReturnValueOnce(linkEl);

    await downloadPatientRegulatoryExport('patient-1', patient);

    expect(linkEl.download).toBe('Maria Eugenia Flores Tapia - Regulatorio.zip');
  });
});