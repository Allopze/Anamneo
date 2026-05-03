import { BadRequestException } from '@nestjs/common';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EncountersPdfService } from './encounters-pdf.service';
import { getEncounterIdentificationMissingFields } from './encounters-pdf.helpers';

function countPdfPages(buffer: Buffer) {
  return buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

function hasCommand(command: string) {
  try { execFileSync('command', ['-v', command], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

describe('EncountersPdfService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const settingsService = {
    getAll: jest.fn().mockResolvedValue({
      'clinic.name': 'Clínica Anamneo',
      'clinic.identifier': '76.123.456-7',
      'clinic.address': 'Av. Salud 123',
      'clinic.phone': '+56 2 2222 2222',
      'clinic.email': 'contacto@anamneo.cl',
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getAll.mockClear();
  });

  it('blocks official document export when the encounter is still in progress', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enc-1',
          medicoId: 'med-1',
          status: 'EN_PROGRESO',
          createdAt: new Date('2026-04-08T12:00:00.000Z'),
          sections: [],
          patient: {
            id: 'patient-1',
            nombre: 'Paciente Demo',
            rut: '11.111.111-1',
            rutExempt: false,
            rutExemptReason: null,
            fechaNacimiento: new Date('1986-04-08T00:00:00.000Z'),
            edad: 40,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            completenessStatus: 'VERIFICADA',
          },
          createdBy: { nombre: 'Dra. Rivera', email: 'medico@anamneo.cl' },
        }),
      },
    };

    const service = new EncountersPdfService(prisma as any, auditService as any, settingsService as any);

    await expect(
      service.getPdfFilename('enc-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('renders the focused ordenes PDF when structured exams are present', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enc-2',
          patientId: 'patient-1',
          medicoId: 'med-1',
          reviewStatus: 'NO_REQUIERE_REVISION',
          status: 'COMPLETADO',
          createdAt: new Date('2026-04-08T12:00:00.000Z'),
          sections: [
            {
              sectionKey: 'IDENTIFICACION',
              schemaVersion: 1,
              data: JSON.stringify({
                nombre: 'Paciente Demo',
                edad: 40,
              }),
            },
            {
              sectionKey: 'TRATAMIENTO',
              schemaVersion: 1,
              data: JSON.stringify({
                examenesEstructurados: [
                  {
                    nombre: 'Hemograma',
                    indicacion: 'Control anual',
                    estado: 'PENDIENTE',
                  },
                ],
              }),
            },
          ],
          patient: {
            id: 'patient-1',
            nombre: 'Paciente Demo',
            rut: '11.111.111-1',
            rutExempt: false,
            rutExemptReason: null,
            fechaNacimiento: new Date('1986-04-08T00:00:00.000Z'),
            edad: 40,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            completenessStatus: 'VERIFICADA',
          },
          createdBy: { nombre: 'Dra. Rivera', email: 'medico@anamneo.cl' },
        }),
      },
    };

    const service = new EncountersPdfService(prisma as any, auditService as any, settingsService as any);

    const pdfBuffer = await service.generateFocusedPdf('enc-2', 'ordenes', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(countPdfPages(pdfBuffer)).toBe(1);
    expect(settingsService.getAll).toHaveBeenCalled();

    const snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-pdf-visual-'));
    const pdfPath = path.join(snapshotDir, 'ordenes.pdf');
    const pngBasePath = path.join(snapshotDir, 'ordenes');
    fs.writeFileSync(pdfPath, pdfBuffer);
    if (hasCommand('pdftoppm')) {
      execFileSync('pdftoppm', ['-png', '-singlefile', '-r', '72', pdfPath, pngBasePath]);
      const pngPath = `${pngBasePath}.png`;
      expect(fs.existsSync(pngPath)).toBe(true);
      expect(fs.statSync(pngPath).size).toBeGreaterThan(1000);
    }

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Encounter',
        entityId: 'enc-2',
        action: 'EXPORT',
      }),
    );
  });

  it('treats fechaNacimiento as a valid identification date representation', () => {
    expect(
      getEncounterIdentificationMissingFields({
        rut: '11.111.111-1',
        fechaNacimiento: '1990-05-12',
        sexo: 'FEMENINO',
        prevision: 'FONASA',
      }),
    ).toEqual([]);
  });

  it('renders the full PDF without an identification warning when fechaNacimiento is present', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enc-3',
          medicoId: 'med-1',
          reviewStatus: 'NO_REQUIERE_REVISION',
          status: 'COMPLETADO',
          createdAt: new Date('2026-04-08T12:00:00.000Z'),
          sections: [
            {
              sectionKey: 'IDENTIFICACION',
              schemaVersion: 1,
              data: JSON.stringify({
                nombre: 'Paciente Demo',
                fechaNacimiento: '1990-05-12',
                sexo: 'FEMENINO',
                prevision: 'FONASA',
                rut: '11.111.111-1',
              }),
            },
            {
              sectionKey: 'MOTIVO_CONSULTA',
              schemaVersion: 1,
              data: JSON.stringify({ texto: 'Dolor de cabeza' }),
            },
            {
              sectionKey: 'TRATAMIENTO',
              schemaVersion: 1,
              data: JSON.stringify({
                planTexto: 'Hidratación y control.',
                medicamentosEstructurados: [{
                  nombre: 'Paracetamol',
                  dosis: '500 mg',
                  via: 'Oral',
                  frecuencia: 'Cada 8 horas',
                }],
              }),
            },
          ],
          patient: {
            id: 'patient-1',
            nombre: 'Paciente Demo',
            rut: '11.111.111-1',
            rutExempt: false,
            rutExemptReason: null,
            fechaNacimiento: new Date('1990-05-12T00:00:00.000Z'),
            edad: 33,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            completenessStatus: 'VERIFICADA',
          },
          createdBy: { nombre: 'Dra. Rivera', email: 'medico@anamneo.cl' },
        }),
      },
    };

    const service = new EncountersPdfService(prisma as any, auditService as any, settingsService as any);
    const pdfBuffer = await service.generatePdf('enc-3', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    } as any);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(countPdfPages(pdfBuffer)).toBe(1);
    expect(settingsService.getAll).toHaveBeenCalled();
  });

  it('does not add extra footer-only pages when the clinical PDF spans multiple pages', async () => {
    const longText = Array.from({ length: 110 }, () => 'Dolor abdominal persistente con evolucion documentada.').join(' ');
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enc-4',
          medicoId: 'med-1',
          reviewStatus: 'NO_REQUIERE_REVISION',
          status: 'COMPLETADO',
          createdAt: new Date('2026-04-08T12:00:00.000Z'),
          sections: [
            {
              sectionKey: 'IDENTIFICACION',
              schemaVersion: 1,
              data: JSON.stringify({
                nombre: 'Paciente Demo',
                fechaNacimiento: '1990-05-12',
                sexo: 'FEMENINO',
                prevision: 'FONASA',
                rut: '11.111.111-1',
              }),
            },
            {
              sectionKey: 'MOTIVO_CONSULTA',
              schemaVersion: 1,
              data: JSON.stringify({ texto: longText }),
            },
            {
              sectionKey: 'ANAMNESIS_PROXIMA',
              schemaVersion: 1,
              data: JSON.stringify({ relatoAmpliado: longText }),
            },
          ],
          patient: {
            id: 'patient-1',
            nombre: 'Paciente Demo',
            rut: '11.111.111-1',
            rutExempt: false,
            rutExemptReason: null,
            fechaNacimiento: new Date('1990-05-12T00:00:00.000Z'),
            edad: 33,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            completenessStatus: 'VERIFICADA',
          },
          createdBy: { nombre: 'Dra. Rivera', email: 'medico@anamneo.cl' },
        }),
      },
    };

    const service = new EncountersPdfService(prisma as any, auditService as any, settingsService as any);
    const pdfBuffer = await service.generatePdf('enc-4', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    } as any);

    const pageCount = countPdfPages(pdfBuffer);
    expect(pageCount).toBeGreaterThan(1);
    expect(pageCount).toBeLessThan(6);
  });
});
