import { BadRequestException } from '@nestjs/common';
import { EncountersPdfService } from './encounters-pdf.service';

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
});
