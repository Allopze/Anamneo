import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientsRegulatoryPurgeService } from './patients-regulatory-purge.service';

function buildPrismaMock() {
  return {
    patient: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

function buildConfig(value: number | undefined) {
  return { get: jest.fn().mockReturnValue(value) } as any;
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildExport() {
  return {
    snapshotForPurge: jest.fn().mockResolvedValue('/runtime/data/purges/snap.zip'),
  } as any;
}

function service(opts?: { prisma?: any; config?: any; audit?: any; exp?: any }) {
  return new PatientsRegulatoryPurgeService(
    opts?.prisma ?? buildPrismaMock(),
    opts?.config ?? buildConfig(5475),
    opts?.audit ?? buildAudit(),
    opts?.exp ?? buildExport(),
  );
}

const user = { id: 'u1', role: 'ADMIN', isAdmin: true } as any;

describe('PatientsRegulatoryPurgeService', () => {
  it('rejects when confirmation is missing or wrong', async () => {
    await expect(
      service().purgePatient('p1', user, { justification: 'a'.repeat(20) }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service().purgePatient('p1', user, { confirmation: 'OTHER', justification: 'a'.repeat(20) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when justification is too short', async () => {
    await expect(
      service().purgePatient('p1', user, { confirmation: 'PURGE-REGULATORY', justification: 'too short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when patient not found', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(
      service({ prisma }).purgePatient('p1', user, {
        confirmation: 'PURGE-REGULATORY',
        justification: 'Justificación regulatoria válida',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when patient is not archived', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue({ id: 'p1', archivedAt: null, nombre: 'X' });
    await expect(
      service({ prisma }).purgePatient('p1', user, {
        confirmation: 'PURGE-REGULATORY',
        justification: 'Justificación regulatoria válida',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when retention period has not elapsed', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue({
      id: 'p1',
      archivedAt: new Date(),
      nombre: 'X',
    });
    await expect(
      service({ prisma, config: buildConfig(5475) }).purgePatient('p1', user, {
        confirmation: 'PURGE-REGULATORY',
        justification: 'Justificación regulatoria válida',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('snapshots, audits and deletes when retention is satisfied', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue({
      id: 'p1',
      archivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      nombre: 'X',
    });
    const exp = buildExport();
    const audit = buildAudit();

    const result = await service({
      prisma,
      audit,
      exp,
      config: buildConfig(1), // 1 dia de retencion para el test
    }).purgePatient('p1', user, {
      confirmation: 'PURGE-REGULATORY',
      justification: 'Justificación regulatoria válida con más de 16 caracteres',
    });

    expect(exp.snapshotForPurge).toHaveBeenCalledWith('p1', user);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE',
      reason: 'PATIENT_RECORD_PURGED_REGULATORY',
    }));
    expect(prisma.patient.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(result.purged).toBe(true);
    expect(result.snapshotPath).toBe('/runtime/data/purges/snap.zip');
  });

  it('honors bypassRetention=true', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue({
      id: 'p1',
      archivedAt: new Date(),
      nombre: 'X',
    });
    const exp = buildExport();

    await expect(
      service({ prisma, exp, config: buildConfig(5475) }).purgePatient('p1', user, {
        confirmation: 'PURGE-REGULATORY',
        justification: 'Bypass justificado por orden judicial',
        bypassRetention: true,
      }),
    ).resolves.toMatchObject({ purged: true });

    expect(prisma.patient.delete).toHaveBeenCalled();
  });
});
