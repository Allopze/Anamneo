import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import {
  decryptBuffer,
  encryptBuffer,
  isEncryptionEnabled,
  isEncryptionEnvelope,
} from '../common/utils/field-crypto';
import { RequestUser } from '../common/utils/medico-id';
import { MailService } from '../mail/mail.service';
import { PatientsRegulatoryExportService } from '../patients/patients-regulatory-export.service';
import { computeRutLookupHash, resolvePatientIdentifiers } from '../patients/patients-identifiers';
import { decryptField } from '../common/utils/field-crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDataRequestExportLinkDto,
  DownloadDataRequestExportDto,
} from './dto/patient-data-rights.dto';
const EXPORT_LINK_DEFAULT_TTL_HOURS = 72;
const EXPORT_LINK_MAX_DOWNLOADS = 3;
@Injectable()
export class PatientDataRequestDeliveryService {
  private readonly logger = new Logger(PatientDataRequestDeliveryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly configService: ConfigService,
    private readonly regulatoryExport: PatientsRegulatoryExportService,
  ) {}
  async createExportLink(id: string, dto: CreateDataRequestExportLinkDto, user: RequestUser) {
    const existing = await this.prisma.patientDataRequest.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!existing) throw new NotFoundException('Solicitud no encontrada');
    if (!['ACCESO', 'PORTABILIDAD'].includes(existing.requestType)) {
      throw new BadRequestException('Solo solicitudes de acceso o portabilidad pueden generar enlace de descarga');
    }
    if (!existing.patientId || !existing.patient) {
      throw new BadRequestException('Debe vincular la solicitud a un paciente antes de generar la entrega');
    }
    if (!existing.identityVerificationMethod) {
      throw new BadRequestException('Debe registrar verificación de identidad antes de generar la entrega');
    }
    const existingPatientIdentifiers = resolvePatientIdentifiers(existing.patient);
    if (!existing.requesterRutLookupHash && !existingPatientIdentifiers.rut) {
      throw new BadRequestException('La descarga requiere RUT del solicitante o del paciente registrado');
    }
    const ttlHours = Number.isFinite(dto.ttlHours) && dto.ttlHours && dto.ttlHours > 0 && dto.ttlHours <= 168
      ? Math.floor(dto.ttlHours)
      : EXPORT_LINK_DEFAULT_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const { buffer, filename } = await this.regulatoryExport.buildZip(existing.patientId, user);
    const fileSha256 = createHash('sha256').update(buffer).digest('hex');
    const baseDir = this.configService.get<string>('DATA_REQUEST_EXPORT_DIR')
      || path.resolve(process.cwd(), 'runtime/data/data-requests');
    await fs.mkdir(baseDir, { recursive: true });
    const safeName = `${existing.id}-${Date.now()}-${filename}`;
    const filePath = path.join(baseDir, isEncryptionEnabled() ? `${safeName}.enc` : safeName);
    let encryptionEnvelope: unknown = null;
    if (isEncryptionEnabled()) {
      const encrypted = encryptBuffer(buffer);
      await fs.writeFile(filePath, encrypted.ciphertext);
      encryptionEnvelope = encrypted.envelope;
    } else {
      this.logger.warn('Data request export stored in CLEARTEXT because ENCRYPTION_KEY is not configured.');
      await fs.writeFile(filePath, buffer);
    }
    const created = await this.prisma.patientDataRequestDownload.create({
      data: {
        requestId: existing.id,
        patientId: existing.patientId,
        tokenHash,
        filePath,
        fileSha256,
        encryptionEnvelope: encryptionEnvelope as never,
        expiresAt,
        maxDownloads: EXPORT_LINK_MAX_DOWNLOADS,
        createdById: user.id,
      },
    });
    await this.prisma.patientDataRequest.update({
      where: { id: existing.id },
      data: {
        payloadResponse: {
          exportDelivery: {
            downloadId: created.id,
            expiresAt: expiresAt.toISOString(),
            maxDownloads: EXPORT_LINK_MAX_DOWNLOADS,
            fileSha256,
          },
        },
      },
    });
    const downloadUrl = this.buildDownloadUrl(token);
    await this.audit.log({
      entityType: 'PatientDataRequestDownload',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      reason: 'PATIENT_DATA_REQUEST_EXPORT_LINK_CREATED',
      diff: {
        requestId: existing.id,
        patientId: existing.patientId,
        expiresAt: expiresAt.toISOString(),
        maxDownloads: EXPORT_LINK_MAX_DOWNLOADS,
        fileSha256,
      },
    });
    const requesterEmail = existing.requesterEmailEnc ? decryptField(existing.requesterEmailEnc) : '';
    const requesterName = existing.requesterNameEnc ? decryptField(existing.requesterNameEnc) : 'Titular';
    const mailResult = await this.mail.sendDataRequestExportLink({
      to: requesterEmail,
      requesterName,
      requestId: existing.id,
      downloadUrl,
      expiresAt,
      maxDownloads: EXPORT_LINK_MAX_DOWNLOADS,
    });
    return {
      id: created.id,
      expiresAt,
      maxDownloads: EXPORT_LINK_MAX_DOWNLOADS,
      downloadUrl,
      mail: mailResult,
    };
  }
  async downloadExport(token: string, dto: DownloadDataRequestExportDto) {
    const tokenHash = hashToken(token);
    const download = await this.prisma.patientDataRequestDownload.findUnique({
      where: { tokenHash },
      include: { request: true, patient: true },
    });
    if (!download) throw new NotFoundException('Enlace no encontrado');
    if (download.revokedAt) throw new UnauthorizedException('Enlace revocado');
    if (download.expiresAt < new Date()) {
      await this.audit.log({
        entityType: 'PatientDataRequestDownload',
        entityId: download.id,
        userId: `public:${download.id}`,
        action: 'UPDATE',
        reason: 'PATIENT_DATA_REQUEST_EXPORT_EXPIRED',
        diff: { requestId: download.requestId, expiresAt: download.expiresAt.toISOString() },
      });
      throw new UnauthorizedException('Enlace expirado');
    }
    if (download.downloadCount >= download.maxDownloads) {
      throw new UnauthorizedException('El enlace alcanzó el máximo de descargas');
    }
    // Phase F-drop — verificar RUT por hash sin depender de columnas plaintext.
    const downloadPatientIdentifiers = resolvePatientIdentifiers(download.patient);
    const suppliedRutHash = computeRutLookupHash(dto.requesterRut);
    const patientRutHash = downloadPatientIdentifiers.rut ? computeRutLookupHash(downloadPatientIdentifiers.rut) : null;
    const requestRutHash = download.request.requesterRutLookupHash;
    const allowedHashes = [requestRutHash, patientRutHash].filter(Boolean);
    if (!suppliedRutHash || !allowedHashes.includes(suppliedRutHash)) {
      throw new UnauthorizedException('RUT no coincide con la solicitud');
    }
    const raw = await fs.readFile(download.filePath);
    const buffer = isEncryptionEnvelope(download.encryptionEnvelope)
      ? decryptBuffer(raw, download.encryptionEnvelope)
      : raw;
    const fileSha256 = createHash('sha256').update(buffer).digest('hex');
    if (fileSha256 !== download.fileSha256) {
      throw new BadRequestException('El archivo de entrega no pasó verificación de integridad');
    }
    await this.prisma.patientDataRequestDownload.update({
      where: { id: download.id },
      data: { downloadCount: { increment: 1 } },
    });
    await this.audit.log({
      entityType: 'PatientDataRequestDownload',
      entityId: download.id,
      userId: `public:${download.id}`,
      action: 'READ',
      reason: 'PATIENT_DATA_REQUEST_EXPORT_DOWNLOADED',
      diff: {
        requestId: download.requestId,
        patientId: download.patientId,
        downloadCount: download.downloadCount + 1,
      },
    });
    return {
      buffer,
      filename: `ficha-clinica-${download.patientId}-${new Date().toISOString().slice(0, 10)}.zip`,
    };
  }
  async revokeExportLink(downloadId: string, reason: string, user: RequestUser) {
    const existing = await this.prisma.patientDataRequestDownload.findUnique({
      where: { id: downloadId },
      select: {
        id: true,
        requestId: true,
        patientId: true,
        filePath: true,
        revokedAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Enlace de descarga no encontrado');
    if (existing.revokedAt) {
      return { id: existing.id, revokedAt: existing.revokedAt, alreadyRevoked: true };
    }
    const revokedAt = new Date();
    const updated = await this.prisma.patientDataRequestDownload.update({
      where: { id: downloadId },
      data: { revokedAt },
    });
    await this.removeDeliveryFile(existing.filePath);
    await this.audit.log({
      entityType: 'PatientDataRequestDownload',
      entityId: existing.id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'PATIENT_DATA_REQUEST_EXPORT_REVOKED',
      diff: {
        requestId: existing.requestId,
        patientId: existing.patientId,
        revokedAt: revokedAt.toISOString(),
        reason: reason.slice(0, 200),
      },
    });
    return updated;
  }
  async markExpiredDownloads() {
    const now = new Date();
    const expired = await this.prisma.patientDataRequestDownload.findMany({
      where: {
        revokedAt: null,
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        requestId: true,
        patientId: true,
        filePath: true,
        expiresAt: true,
      },
      take: 100,
    });
    for (const download of expired) {
      await this.prisma.patientDataRequestDownload.update({
        where: { id: download.id },
        data: { revokedAt: now },
      });
      await this.removeDeliveryFile(download.filePath);
      await this.audit.log({
        entityType: 'PatientDataRequestDownload',
        entityId: download.id,
        userId: `system:${download.id}`,
        action: 'UPDATE',
        reason: 'PATIENT_DATA_REQUEST_EXPORT_EXPIRED',
        diff: {
          requestId: download.requestId,
          patientId: download.patientId,
          expiresAt: download.expiresAt.toISOString(),
          revokedAt: now.toISOString(),
        },
      });
    }
    return expired.length;
  }
  private buildDownloadUrl(token: string) {
    const baseUrl = this.configService.get<string>('APP_PUBLIC_URL')
      || this.configService.get<string>('FRONTEND_PUBLIC_URL')
      || 'http://localhost:5555';
    return `${baseUrl.replace(/\/$/, '')}/descargar-ficha?token=${encodeURIComponent(token)}`;
  }
  private async removeDeliveryFile(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Best effort cleanup: revocation remains authoritative in DB.
    }
  }
}
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
