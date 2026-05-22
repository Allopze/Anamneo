import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import { attachmentUploadsTotal } from '../metrics/metrics-registry';

export type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR' | 'SKIPPED';

interface ScanResult {
  status: ScanStatus;
  detail: string | null;
}

@Injectable()
export class AttachmentsScanService {
  private readonly logger = new Logger(AttachmentsScanService.name);
  private readonly clamdHost?: string;
  private readonly clamdPort?: number;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.clamdHost = configService.get<string>('CLAMAV_HOST')?.trim() || undefined;
    const port = configService.get<string>('CLAMAV_PORT')?.trim();
    this.clamdPort = port ? Number.parseInt(port, 10) : undefined;
    this.enabled = !!(this.clamdHost && this.clamdPort && Number.isFinite(this.clamdPort));
    if (!this.enabled) {
      this.logger.warn(
        'AttachmentsScanService disabled: CLAMAV_HOST/CLAMAV_PORT not configured. Uploads will be marked SKIPPED.',
      );
    }
  }

  /**
   * Lanza el scan en background. Marca el attachment como PENDING en la
   * llamada (sincrónica) y cuando termina actualiza a CLEAN/INFECTED/ERROR.
   * Si está deshabilitado, marca SKIPPED y registra un warning único.
   */
  enqueueScan(attachmentId: string, absolutePath: string, declaredMime: string): void {
    attachmentUploadsTotal.inc({ mime: declaredMime });
    if (!this.enabled) {
      void this.markStatus(attachmentId, 'SKIPPED', 'AV scan deshabilitado');
      return;
    }
    // No bloquea el request actual.
    void this.runScan(attachmentId, absolutePath);
  }

  async runScan(attachmentId: string, absolutePath: string): Promise<ScanResult> {
    try {
      const result = await this.executeClamd(absolutePath);
      await this.markStatus(attachmentId, result.status, result.detail);

      if (result.status === 'INFECTED') {
        await this.quarantineAttachment(attachmentId, absolutePath, result.detail);
      }

      return result;
    } catch (error) {
      const detail = (error as Error).message;
      this.logger.error(`Scan failed for attachment ${attachmentId}: ${detail}`);
      await this.markStatus(attachmentId, 'ERROR', detail);
      return { status: 'ERROR', detail };
    }
  }

  private async executeClamd(absolutePath: string): Promise<ScanResult> {
    // Estrategia: si CLAMAV_HOST=local entonces usamos `clamdscan --fdpass` si
    // está disponible. Si no, conectamos al socket TCP de clamd con protocolo
    // INSTREAM (mínimo). Para mantener este modulo libre de dependencias,
    // implementamos INSTREAM directamente sobre net.Socket.
    return new Promise<ScanResult>(async (resolve, reject) => {
      const net = await import('node:net');
      const socket = new net.Socket();
      let response = '';

      socket.setTimeout(30_000, () => {
        socket.destroy();
        reject(new Error('Scan timeout'));
      });

      socket.connect({ host: this.clamdHost!, port: this.clamdPort! }, async () => {
        try {
          socket.write('nINSTREAM\n');
          const handle = await fs.open(absolutePath, 'r');
          const buffer = Buffer.alloc(64 * 1024);
          let bytesRead = 0;
          try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { bytesRead: n } = await handle.read(buffer, 0, buffer.length);
              if (!n) break;
              bytesRead += n;
              const sizeHeader = Buffer.alloc(4);
              sizeHeader.writeUInt32BE(n, 0);
              socket.write(sizeHeader);
              socket.write(buffer.subarray(0, n));
            }
            const zero = Buffer.alloc(4);
            socket.write(zero);
          } finally {
            await handle.close();
          }
          if (!bytesRead) {
            socket.destroy();
            reject(new Error('Empty file'));
          }
        } catch (err) {
          socket.destroy();
          reject(err);
        }
      });

      socket.on('data', (chunk) => {
        response += chunk.toString();
      });

      socket.on('end', () => {
        const trimmed = response.trim();
        if (/FOUND$/.test(trimmed)) {
          resolve({ status: 'INFECTED', detail: trimmed });
        } else if (/OK$/.test(trimmed)) {
          resolve({ status: 'CLEAN', detail: trimmed });
        } else if (/ERROR$/.test(trimmed)) {
          reject(new Error(trimmed));
        } else {
          reject(new Error(`Unknown clamd response: ${trimmed || '<empty>'}`));
        }
      });

      socket.on('error', reject);
    });
  }

  private async markStatus(attachmentId: string, status: ScanStatus, detail: string | null) {
    try {
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          scanStatus: status,
          scanResult: detail ? detail.slice(0, 1024) : null,
          scannedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Could not persist scan status for ${attachmentId}: ${(error as Error).message}`);
    }
  }

  private async quarantineAttachment(attachmentId: string, absolutePath: string, detail: string | null) {
    try {
      const uploadsRoot = resolveUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
      const quarantineDir = path.join(uploadsRoot, 'quarantine');
      await fs.mkdir(quarantineDir, { recursive: true });
      const targetPath = path.join(quarantineDir, `${attachmentId}-${path.basename(absolutePath)}`);
      await fs.rename(absolutePath, targetPath);

      await this.auditService.log({
        entityType: 'Attachment',
        entityId: attachmentId,
        userId: 'system',
        action: 'UPDATE',
        reason: 'ATTACHMENT_QUARANTINED',
        diff: {
          quarantinedTo: targetPath,
          detail,
        },
      });
    } catch (error) {
      this.logger.error(`Could not quarantine attachment ${attachmentId}: ${(error as Error).message}`);
    }
  }
}

// Mantiene la importacion para no romper futuras integraciones con clamscan binario.
// Si en el futuro CLAMAV_USE_BINARY=true, podemos usar spawn aqui.
void spawn;
