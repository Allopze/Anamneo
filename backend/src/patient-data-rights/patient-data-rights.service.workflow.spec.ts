import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientDataRightsService } from './patient-data-rights.service';

describe('PatientDataRightsService — workflow', () => {
  const baseUser = { id: 'admin-1' } as never;

  function buildService(overrides?: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
    create?: jest.Mock;
    update?: jest.Mock;
    mailAck?: jest.Mock;
    mailExtended?: jest.Mock;
    mailResolved?: jest.Mock;
    mailRejected?: jest.Mock;
    auditLog?: jest.Mock;
  }) {
    const findUnique = overrides?.findUnique ?? jest.fn();
    const findMany = overrides?.findMany ?? jest.fn().mockResolvedValue([]);
    const create = overrides?.create ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'req-1', ...data }));
    const update = overrides?.update ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'req-1', ...data }));
    const mailAck = overrides?.mailAck ?? jest.fn().mockResolvedValue({ sent: true });
    const mailExtended = overrides?.mailExtended ?? jest.fn().mockResolvedValue({ sent: true });
    const mailResolved = overrides?.mailResolved ?? jest.fn().mockResolvedValue({ sent: true });
    const mailRejected = overrides?.mailRejected ?? jest.fn().mockResolvedValue({ sent: true });
    const auditLog = overrides?.auditLog ?? jest.fn().mockResolvedValue(undefined);

    const prisma = {
      patientDataRequest: { findUnique, findMany, create, update },
    } as never;
    const audit = { log: auditLog } as never;
    const mail = {
      sendDataRequestAcknowledgement: mailAck,
      sendDataRequestExtended: mailExtended,
      sendDataRequestResolved: mailResolved,
      sendDataRequestRejected: mailRejected,
    } as never;
    const delivery = {
      markExpiredDownloads: jest.fn().mockResolvedValue(0),
    } as never;

    return {
      service: new PatientDataRightsService(prisma, audit, mail, delivery),
      findUnique,
      create,
      update,
      mailAck,
      mailExtended,
      mailResolved,
      mailRejected,
      auditLog,
    };
  }

  describe('createFromPublic', () => {
    it('crea con SLA = +30 dias y dispara acuse', async () => {
      const { service, create, mailAck } = buildService();
      const dto: any = {
        requesterName: 'Titular',
        requesterEmail: 'titular@example.com',
        requestType: 'ACCESO',
        payloadRequest: 'Solicito copia de mis datos personales',
      };
      const out = await service.createFromPublic(dto, { ip: '1.2.3.4', userAgent: 'jest' });
      expect(create).toHaveBeenCalled();
      const callArg = create.mock.calls[0][0];
      const dueDateMs = new Date(callArg.data.dueDate).getTime();
      const expectedDueDateMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(dueDateMs - expectedDueDateMs)).toBeLessThan(5000);
      expect(callArg.data.requesterName).toBeUndefined();
      expect(callArg.data.requesterRut).toBeUndefined();
      expect(callArg.data.requesterEmail).toBeUndefined();
      expect(callArg.data.requesterNameEnc).toMatch(/^enc:v1:/);
      expect(callArg.data.requesterEmailEnc).toMatch(/^enc:v1:/);
      expect(out.status).toBe('RECIBIDA');
      expect(mailAck).toHaveBeenCalledWith(expect.objectContaining({
        to: 'titular@example.com',
      }));
    });
  });

  describe('extend', () => {
    it('rechaza si no existe', async () => {
      const { service } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });
      await expect(
        service.extend('r-1', { reason: 'razon valida con suficiente largo' } as never, baseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza si ya tiene prorroga (Art 11 permite una sola)', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          dueDate: new Date(),
          prorrogaDueDate: new Date(),
          requesterEmail: 'x@x.com',
          requesterName: 'x',
          requestType: 'ACCESO',
        }),
      });
      await expect(
        service.extend('r-1', { reason: 'razon valida con suficiente largo' } as never, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('aplica prorroga +30 dias y envia correo', async () => {
      const dueDate = new Date();
      const { service, update, mailExtended } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          dueDate,
          prorrogaDueDate: null,
          requesterEmail: 'x@x.com',
          requesterName: 'x',
          requestType: 'ACCESO',
        }),
      });
      await service.extend('r-1', { reason: 'razon valida con suficiente largo' } as never, baseUser);
      const updateArgs = update.mock.calls[0][0];
      const newDue = new Date(updateArgs.data.prorrogaDueDate);
      expect(newDue.getTime() - dueDate.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
      expect(mailExtended).toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('rechaza si ya esta resuelta', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'r-1', status: 'RESUELTA_ACEPTADA' }),
      });
      await expect(
        service.resolve('r-1', { status: 'RESUELTA_ACEPTADA', resolutionNote: 'nota' } as never, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resuelve aceptada y dispara correo Resolved', async () => {
      const { service, update, mailResolved } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          status: 'EN_REVISION',
          requesterEmail: 'x@x.com',
          requesterName: 'x',
          requestType: 'ACCESO',
        }),
      });
      await service.resolve(
        'r-1',
        { status: 'RESUELTA_ACEPTADA', resolutionNote: 'Bundle entregado por canal seguro' } as never,
        baseUser,
      );
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'RESUELTA_ACEPTADA', resolvedById: 'admin-1' }),
      }));
      expect(mailResolved).toHaveBeenCalled();
    });

    it('rechazada dispara correo Rejected', async () => {
      const { service, mailRejected } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          status: 'EN_REVISION',
          requesterEmail: 'x@x.com',
          requesterName: 'x',
          requestType: 'SUPRESION',
        }),
      });
      await service.resolve(
        'r-1',
        { status: 'RESUELTA_RECHAZADA', resolutionNote: 'Excepcion Art 7: conservacion sanitaria obligatoria' } as never,
        baseUser,
      );
      expect(mailRejected).toHaveBeenCalled();
    });
  });

  describe('markExpiredRequests', () => {
    it('marca solo las que pasaron el plazo (incluyendo prorroga si existe)', async () => {
      const past = new Date(Date.now() - 1000);
      const future = new Date(Date.now() + 1000);
      const { service, update, auditLog } = buildService({
        findMany: jest.fn().mockResolvedValue([
          { id: 'r-past', dueDate: past, prorrogaDueDate: null },
          { id: 'r-prorroga-past', dueDate: past, prorrogaDueDate: past },
          { id: 'r-prorroga-future', dueDate: past, prorrogaDueDate: future },
          { id: 'r-future', dueDate: future, prorrogaDueDate: null },
        ]),
      });
      await service.markExpiredRequests();
      expect(update).toHaveBeenCalledTimes(2);
      expect(auditLog).toHaveBeenCalledTimes(2);
    });
  });
});
