import { findPatientsReadModel } from './patients-list-read-model';

function patient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'patient-1',
    rut: '11.111.111-1',
    rutExempt: false,
    rutExemptReason: null,
    nombre: 'Ana Perez',
    fechaNacimiento: null,
    edad: 30,
    edadMeses: null,
    sexo: null,
    trabajo: null,
    prevision: null,
    registrationMode: 'COMPLETO',
    completenessStatus: 'VERIFICADA',
    demographicsVerifiedAt: null,
    demographicsVerifiedById: null,
    domicilio: null,
    telefono: null,
    email: null,
    contactoEmergenciaNombre: null,
    contactoEmergenciaTelefono: null,
    centroMedico: null,
    archivedAt: null,
    archivedById: null,
    createdAt: new Date('2026-04-19T10:00:00.000Z'),
    updatedAt: new Date('2026-04-19T10:00:00.000Z'),
    _count: { encounters: 1 },
    ...overrides,
  };
}

describe('findPatientsReadModel clinical search', () => {
  it('uses the clinical search projection instead of loading encounter sections', async () => {
    const prisma = {
      patient: {
        findMany: jest.fn().mockResolvedValue([patient()]),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1),
      },
    } as any;

    const result = await findPatientsReadModel({
      prisma,
      user: { id: 'med-1', role: 'MEDICO', isAdmin: false } as any,
      effectiveMedicoId: 'med-1',
      page: 1,
      limit: 10,
      filters: { clinicalSearch: 'dolor' },
    });

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              clinicalSearches: {
                some: {
                  text: { contains: 'dolor' },
                  medicoId: 'med-1',
                },
              },
            }),
          ]),
        }),
        include: { _count: { select: { encounters: true } } },
      }),
    );
    expect(prisma.patient.findMany.mock.calls[0][0].include).not.toHaveProperty('encounters');
    expect(result.pagination).toMatchObject({ total: 1 });
    expect(result.pagination).not.toHaveProperty('clinicalSearchCapped');
  });
});
