import { BadRequestException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects uploads when the encounter is not in progress', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'COMPLETADO',
          medicoId: 'med-1',
          patient: { id: 'pat-1' },
        }),
      },
    };
    const service = new AttachmentsService(
      prisma as never,
      { get: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    await expect(
      service.create(
        'enc-1',
        {
          path: '/tmp/fake.pdf',
          filename: 'fake.pdf',
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          size: 123,
        } as Express.Multer.File,
        { id: 'med-1', role: 'MEDICO' },
      ),
    ).rejects.toThrow(new BadRequestException('Solo se pueden modificar adjuntos de atenciones en progreso'));
  });

  it('rejects deletions when the encounter is not in progress', async () => {
    const prisma = {
      attachment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-1',
          encounterId: 'enc-1',
          uploadedById: 'med-1',
          originalName: 'resultado.pdf',
          mime: 'application/pdf',
          size: 321,
          storagePath: 'enc-1/resultado.pdf',
          category: 'GENERAL',
          linkedOrderType: null,
          linkedOrderId: null,
          deletedAt: null,
          encounter: {
            id: 'enc-1',
            status: 'FIRMADO',
            medicoId: 'med-1',
            patient: { id: 'pat-1' },
          },
        }),
      },
    };
    const service = new AttachmentsService(
      prisma as never,
      { get: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    await expect(service.remove('att-1', { id: 'med-1', role: 'MEDICO' })).rejects.toThrow(
      new BadRequestException('Solo se pueden modificar adjuntos de atenciones en progreso'),
    );
  });
});