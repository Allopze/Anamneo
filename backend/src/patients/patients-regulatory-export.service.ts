import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as archiver from 'archiver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PassThrough } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decryptField } from '../common/utils/field-crypto';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import { sanitizeFilename } from '../attachments/attachments-helpers';
import { RequestUser } from '../common/utils/medico-id';

type AttachmentSnapshot = {
  id: string;
  storagePath: string;
  archivePath: string;
};

@Injectable()
export class PatientsRegulatoryExportService {
  private readonly logger = new Logger(PatientsRegulatoryExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private getUploadsRoot() {
    return resolveUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
  }

  private resolveStoragePath(storagePath: string): string {
    const uploadsRoot = this.getUploadsRoot();
    const absolutePath = path.isAbsolute(storagePath)
      ? path.normalize(storagePath)
      : path.resolve(uploadsRoot, storagePath);
    const relativeToRoot = path.relative(uploadsRoot, absolutePath);
    if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new NotFoundException('Archivo de adjunto fuera del root permitido');
    }
    return absolutePath;
  }

  private sanitizeSegment(value: string | null | undefined, fallback: string) {
    const normalized = (value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._ -]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
    return normalized || fallback;
  }

  private decryptSectionData(raw: string): unknown {
    try {
      const decrypted = decryptField(raw);
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.warn(`Could not decrypt or parse encounter section: ${(error as Error).message}`);
      return { __decryptError: true, raw: '[ENCRYPTED]' };
    }
  }

  /**
   * Construye el bundle regulatorio completo para Ley 19.628 / 21.719.
   * Solo para uso admin. Incluye PHI desencriptada y AuditLog asociado.
   */
  async buildRegulatoryBundle(patientId: string, user: RequestUser): Promise<{
    json: Record<string, unknown>;
    attachments: AttachmentSnapshot[];
  }> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const history = await this.prisma.patientHistory.findUnique({ where: { patientId } });

    const encounters = await this.prisma.encounter.findMany({
      where: { patientId },
      include: {
        sections: true,
        signatures: true,
        diagnoses: true,
        treatments: { include: { outcomes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const encounterIds = encounters.map((e) => e.id);

    const attachments = encounterIds.length
      ? await this.prisma.attachment.findMany({
          where: { encounterId: { in: encounterIds } },
          orderBy: { uploadedAt: 'asc' },
        })
      : [];

    const consents = await this.prisma.informedConsent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
    });
    const alerts = await this.prisma.clinicalAlert.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
    });
    const problems = await this.prisma.patientProblem.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
    });
    const tasks = await this.prisma.encounterTask.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
    });

    const auditEntityIds = [patientId, ...encounterIds, ...attachments.map((a) => a.id)];
    const auditLogs = auditEntityIds.length
      ? await this.prisma.auditLog.findMany({
          where: { entityId: { in: auditEntityIds } },
          orderBy: { timestamp: 'asc' },
        })
      : [];

    const attachmentSnapshots: AttachmentSnapshot[] = [];
    const attachmentManifest = attachments.map((att) => {
      const safeName = sanitizeFilename(att.originalName || `${att.id}`);
      const archivePath = `attachments/${att.encounterId}/${att.id}-${safeName}`;
      attachmentSnapshots.push({
        id: att.id,
        storagePath: att.storagePath,
        archivePath,
      });
      return {
        id: att.id,
        encounterId: att.encounterId,
        originalName: att.originalName,
        mime: att.mime,
        size: att.size,
        category: att.category,
        description: att.description,
        uploadedAt: att.uploadedAt,
        deletedAt: att.deletedAt,
        archivePath,
      };
    });

    const json = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: user.id,
        email: user.email ?? null,
        nombre: user.nombre ?? null,
        role: user.role,
        isAdmin: user.isAdmin ?? false,
      },
      regulatoryContext: {
        purpose: 'Ley 19.628 / Ley 21.719 — Derecho de acceso y portabilidad del titular',
        warning: 'Documento contiene datos sensibles de salud. Tratar bajo principios de minimizacion y confidencialidad.',
      },
      patient: {
        ...patient,
        history,
      },
      encounters: encounters.map((encounter) => ({
        ...encounter,
        sections: encounter.sections.map((section) => ({
          id: section.id,
          sectionKey: section.sectionKey,
          schemaVersion: section.schemaVersion,
          completed: section.completed,
          notApplicable: section.notApplicable,
          notApplicableReason: section.notApplicableReason,
          updatedAt: section.updatedAt,
          data: this.decryptSectionData(section.data),
        })),
      })),
      attachments: attachmentManifest,
      consents,
      alerts,
      problems,
      tasks,
      auditLogs: auditLogs.map((log) => ({
        ...log,
        diff: log.diff ? safeParseJson(log.diff) : null,
      })),
    };

    return { json, attachments: attachmentSnapshots };
  }

  /**
   * Convierte el bundle en un zip con `data.json` + carpeta `attachments/`.
   */
  async buildZip(patientId: string, user: RequestUser): Promise<{ buffer: Buffer; filename: string }> {
    const { json, attachments } = await this.buildRegulatoryBundle(patientId, user);
    const buffer = await this.createArchiveBuffer(json, attachments);

    const filename = `paciente-${patientId}-regulatorio-${new Date().toISOString().slice(0, 10)}.zip`;

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'EXPORT',
      reason: 'PATIENT_DATA_EXPORTED_REGULATORY',
      diff: {
        scope: 'REGULATORY_FULL',
        attachmentCount: attachments.length,
        encounterCount: Array.isArray(json.encounters) ? (json.encounters as unknown[]).length : 0,
        sizeBytes: buffer.length,
      },
    });

    return { buffer, filename };
  }

  /**
   * Snapshot regulatorio que se persiste a `runtime/data/purges/<patientId>/...`
   * justo antes de un purge. Devuelve la ruta para anotarla en audit log.
   */
  async snapshotForPurge(patientId: string, user: RequestUser): Promise<string> {
    const { buffer, filename } = await this.buildZip(patientId, user);
    const baseDir = this.configService.get<string>('REGULATORY_PURGE_DIR')
      || path.resolve(process.cwd(), 'runtime/data/purges');
    await fs.mkdir(baseDir, { recursive: true });
    const targetPath = path.join(baseDir, filename);
    await fs.writeFile(targetPath, buffer);
    return targetPath;
  }

  private async createArchiveBuffer(json: Record<string, unknown>, attachments: AttachmentSnapshot[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const pass = new PassThrough();
      const chunks: Buffer[] = [];
      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
      archive.on('error', reject);
      archive.pipe(pass);

      (async () => {
        archive.append(JSON.stringify(json, null, 2), { name: 'data.json' });
        for (const att of attachments) {
          try {
            const absolutePath = this.resolveStoragePath(att.storagePath);
            const content = await fs.readFile(absolutePath);
            archive.append(content, { name: att.archivePath });
          } catch (error) {
            this.logger.warn(
              `Attachment ${att.id} could not be embedded in regulatory bundle: ${(error as Error).message}`,
            );
            archive.append(
              `[MISSING_FILE] ${att.storagePath}\n`,
              { name: `${att.archivePath}.missing.txt` },
            );
          }
        }
        await archive.finalize();
      })().catch(reject);
    });
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
