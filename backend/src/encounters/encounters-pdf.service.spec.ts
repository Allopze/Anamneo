import { BadRequestException } from '@nestjs/common';
import { EncountersPdfService } from './encounters-pdf.service';
import { getEncounterIdentificationMissingFields } from './encounters-pdf.helpers';

describe('EncountersPdfService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    const service = new EncountersPdfService(prisma as any, auditService as any);

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

    const service = new EncountersPdfService(prisma as any, auditService as any);

    const pdfBuffer = await service.generateFocusedPdf('enc-2', 'ordenes', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
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

    const service = new EncountersPdfService(prisma as any, auditService as any);
    const pdfBuffer = await service.generatePdf('enc-3', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    } as any);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
