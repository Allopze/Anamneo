import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UnauthorizedException } from '@nestjs/common';
import { PatientDataRequestDeliveryService } from './patient-data-request-delivery.service';

describe('PatientDataRightsService export delivery links', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-data-request-'));
  const zipBuffer = Buffer.from('PK fake zip');

  function buildService(overrides: Record<string, unknown> = {}) {
    const downloadRow = {
      id: 'download-1',
      requestId: 'request-1',
      patientId: 'patient-1',
      filePath: path.join(tmpDir, 'export.zip'),
      fileSha256: '4f3aea976d11d4a3656e8e45d8c1bbd1b8c4f6f3b4363e7b6440de345f2a0942',
      encryptionEnvelope: null,
      expiresAt: new Date(Date.now() + 60_000),
      downloadCount: 0,
      maxDownloads: 3,
      revokedAt: null,
      request: {
        id: 'request-1',
        requesterRut: '12.345.678-5',
      },
      patient: {
        id: 'patient-1',
        rut: '12.345.678-5',
      },
      ...overrides,
    };
    fs.writeFileSync(downloadRow.filePath, zipBuffer);

    const prisma = {
      patientDataRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      patientDataRequestDownload: {
        findUnique: jest.fn().mockResolvedValue(downloadRow),
        findMany: jest.fn().mockResolvedValue([downloadRow]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(downloadRow),
      },
    };

    const service = new PatientDataRequestDeliveryService(
      prisma as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { sendDataRequestAcknowledgement: jest.fn(), sendDataRequestExportLink: jest.fn() } as any,
      { get: jest.fn((key: string) => key === 'DATA_REQUEST_EXPORT_DIR' ? tmpDir : undefined) } as any,
      { buildZip: jest.fn().mockResolvedValue({ buffer: zipBuffer, filename: 'export.zip' }) } as any,
    );
    return { service, prisma, downloadRow };
  }

  it('requires the requester RUT before serving the ZIP', async () => {
    const { service } = buildService();
    await expect(service.downloadExport('token', { requesterRut: '11.111.111-1' }))
      .rejects
      .toBeInstanceOf(UnauthorizedException);
  });

  it('serves a valid ZIP when token and RUT match', async () => {
    const { service, prisma } = buildService();
    const result = await service.downloadExport('token', { requesterRut: '12.345.678-5' });
    expect(result.buffer.equals(zipBuffer)).toBe(true);
    expect(result.filename).toMatch(/ficha-clinica-patient-1/);
    expect(prisma.patientDataRequestDownload.update).toHaveBeenCalledWith({
      where: { id: 'download-1' },
      data: { downloadCount: { increment: 1 } },
    });
  });

  it('revokes an export link and removes the stored delivery file', async () => {
    const { service, prisma, downloadRow } = buildService();
    await service.revokeExportLink('download-1', 'Solicitud del titular', { id: 'admin-1' } as any);
    expect(prisma.patientDataRequestDownload.update).toHaveBeenCalledWith({
      where: { id: 'download-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(fs.existsSync(downloadRow.filePath)).toBe(false);
  });

  it('revokes expired export links during cleanup', async () => {
    const { service, prisma, downloadRow } = buildService({
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(service.markExpiredDownloads()).resolves.toBe(1);
    expect(prisma.patientDataRequestDownload.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revokedAt: null }),
      take: 100,
    }));
    expect(fs.existsSync(downloadRow.filePath)).toBe(false);
  });
});
