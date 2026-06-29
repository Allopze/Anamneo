import { BadRequestException } from '@nestjs/common';
import { exportOperationalEncountersCsvReadModel } from './patients-operational-export-read-model';

const patientIdentifiers = {
  rutEnc: null,
  nombreEnc: null,
  telefonoEnc: null,
  emailEnc: null,
  domicilioEnc: null,
  contactoEmergenciaNombreEnc: null,
  contactoEmergenciaTelefonoEnc: null,
  legalRepresentativeNameEnc: null,
  legalRepresentativeRutEnc: null,
  legalRepresentativeRutLookupHash: null,
  legalRepresentativeRelationshipEnc: null,
  legalRepresentativeContactEnc: null,
};

describe('exportOperationalEncountersCsvReadModel', () => {
  it('exports operational encounter rows and audits the selected window', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'encounter-1',
            status: 'EN_PROGRESO',
            createdAt: new Date('2026-05-20T13:00:00.000Z'),
            patient: {
              ...patientIdentifiers,
              edad: 42,
              edadMeses: null,
              sexo: 'FEMENINO',
              prevision: 'FONASA',
              registrationMode: 'RAPIDO',
              completenessStatus: 'PENDIENTE_VERIFICACION',
              rutExempt: true,
              rutExemptReason: 'Extranjero',
            },
            medico: { id: 'medico-1', nombre: 'Dra. Demo', email: 'demo@example.test' },
            createdBy: { id: 'assistant-1', nombre: 'Asistente Demo', email: 'a@example.test', role: 'ASISTENTE' },
            diagnoses: [{ label: 'Cefalea' }],
            treatments: [{ label: 'Analgesia' }],
          },
        ]),
      },
    } as any;
    const auditService = { log: jest.fn() } as any;

    const csv = await exportOperationalEncountersCsvReadModel({
      prisma,
      auditService,
      user: { id: 'admin-1', isAdmin: true, role: 'ADMIN' } as any,
      filters: { fromDate: '2026-05-20', toDate: '2026-05-21', medicoId: 'medico-1' },
    });

    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          medicoId: 'medico-1',
          createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
          patient: { archivedAt: null },
        }),
      }),
    );
    expect(csv).toContain('Fecha,Estado,Medico');
    expect(csv).toContain('"EN_PROGRESO"');
    expect(csv).toContain('"Dra. Demo"');
    expect(csv).toContain('"Extranjero"');
    expect(csv).toContain('"Cefalea"');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'OperationalEncounterExport',
        action: 'EXPORT',
        diff: {
          export: {
            format: 'csv',
            fromDate: '2026-05-20',
            toDate: '2026-05-21',
            medicoId: 'medico-1',
            encounterCount: 1,
          },
        },
      }),
    );
  });

  it('rejects inverted date windows', async () => {
    await expect(exportOperationalEncountersCsvReadModel({
      prisma: {} as any,
      auditService: {} as any,
      user: { id: 'admin-1', isAdmin: true, role: 'ADMIN' } as any,
      filters: { fromDate: '2026-05-22', toDate: '2026-05-21' },
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
