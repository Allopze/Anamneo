import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as archiver from 'archiver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PassThrough } from 'stream';
import { AuditService } from '../audit/audit.service';
import { sanitizeFilename } from '../attachments/attachments-helpers';
import { assertLoadedPatientAccess } from '../common/utils/patient-access';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentsService } from '../consents/consents.service';
import { PatientsPdfService } from './patients-pdf.service';

type ScopedAttachment = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  storagePath: string;
  uploadedAt: Date;
  category: string | null;
  description: string | null;
  encounter: {
    id: string;
    status: string;
    createdAt: Date;
  };
};

@Injectable()
export class PatientsExportBundleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly consentsService: ConsentsService,
    private readonly patientsPdfService: PatientsPdfService,
  ) {}

  private getUploadsRoot() {
    return resolveUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
  }

  private resolveStoragePath(storagePath: string) {
    const uploadsRoot = this.getUploadsRoot();
    const absolutePath = path.isAbsolute(storagePath)
      ? path.normalize(storagePath)
      : path.resolve(uploadsRoot, storagePath);
    const relativeToRoot = path.relative(uploadsRoot, absolutePath);

    if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    return absolutePath;
  }

  private sanitizeSegment(value: string | null | undefined, fallback: string) {
    const normalized = (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._ -]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');

    return normalized || fallback;
  }

  private buildBundleFilename(patientName: string) {
    const safeName = this.sanitizeSegment(patientName, 'Paciente');
    const exportDate = new Date().toISOString().slice(0, 10);
    return `${safeName} - Paquete clinico - ${exportDate}.zip`;
  }

  private buildEncounterFolderName(attachment: ScopedAttachment) {
    const encounterDate = attachment.encounter.createdAt.toISOString().slice(0, 10);
    const encounterStatus = this.sanitizeSegment(attachment.encounter.status.toLowerCase(), 'encuentro');
    const encounterShortId = attachment.encounter.id.slice(0, 8);
    return `${encounterDate}_${encounterStatus}_${encounterShortId}`;
  }

  private buildAttachmentEntryName(attachment: ScopedAttachment) {
    const uploadedStamp = attachment.uploadedAt.toISOString().replace(/[:]/g, '-');
    const safeOriginalName = this.sanitizeSegment(sanitizeFilename(attachment.originalName), 'adjunto');
    return `${uploadedStamp}_${attachment.id.slice(0, 8)}_${safeOriginalName}`;
  }

  private async createArchiveBuffer(params: {
    longitudinalPdf: Buffer;
    consents: unknown[];
    attachments: ScopedAttachment[];
    manifest: Record<string, unknown>;
    warnings: string[];
  }) {
    const { longitudinalPdf, consents, attachments, manifest, warnings } = params;

    return new Promise<Buffer>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      output.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      output.on('end', () => resolve(Buffer.concat(chunks)));

      archive.on('warning', (error: Error & { code?: string }) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          warnings.push(`adjunto_omitido:${error.message}`);
          return;
        }

        reject(error);
      });

      archive.on('error', reject);
      archive.pipe(output);

      archive.append(longitudinalPdf, { name: 'historial-clinico.pdf' });
      archive.append(JSON.stringify(consents, null, 2), { name: 'consentimientos.json' });

      void (async () => {
        for (const attachment of attachments) {
          try {
            const absolutePath = this.resolveStoragePath(attachment.storagePath);
            await fs.access(absolutePath);
            const fileBuffer = await fs.readFile(absolutePath);
            archive.append(fileBuffer, {
              name: `adjuntos/${this.buildEncounterFolderName(attachment)}/${this.buildAttachmentEntryName(attachment)}`,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'archivo no disponible';
            warnings.push(`adjunto_omitido:${attachment.id}:${message}`);
          }
        }

        archive.append(JSON.stringify({ ...manifest, warnings }, null, 2), { name: 'manifest.json' });
        await archive.finalize();
      })().catch(reject);
    });
  }

  async generateBundle(patientId: string, user: RequestUser) {
    const effectiveMedicoId = user.isAdmin ? null : getEffectiveMedicoId(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        nombre: true,
        rut: true,
        rutExempt: true,
        rutExemptReason: true,
        edad: true,
        edadMeses: true,
        sexo: true,
        prevision: true,
        completenessStatus: true,
        registrationMode: true,
        archivedAt: true,
        createdById: true,
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    const scopedPatient = await assertLoadedPatientAccess(this.prisma, user, patientId, patient);
    assertEncounterClinicalOutputAllowed(scopedPatient, 'EXPORT_OFFICIAL_DOCUMENTS');

    const attachments = await this.prisma.attachment.findMany({
      where: {
        deletedAt: null,
        encounter: {
          patientId,
          ...(effectiveMedicoId ? { medicoId: effectiveMedicoId } : {}),
        },
      },
      select: {
        id: true,
        originalName: true,
        mime: true,
        size: true,
        storagePath: true,
        uploadedAt: true,
        category: true,
        description: true,
        encounter: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { uploadedAt: 'asc' },
    });

    const consents = await this.consentsService.findByPatient(patientId, user);
    const warnings: string[] = [];
    const longitudinalPdf = await this.patientsPdfService.generateLongitudinalPdf(patientId, user);
    const manifest = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: user.id,
        nombre: user.nombre ?? null,
        email: user.email ?? null,
        role: user.role,
      },
      patient: {
        id: scopedPatient.id,
        nombre: scopedPatient.nombre,
        rut: scopedPatient.rut,
        rutExempt: scopedPatient.rutExempt,
        rutExemptReason: scopedPatient.rutExemptReason,
        completenessStatus: scopedPatient.completenessStatus,
        registrationMode: scopedPatient.registrationMode,
      },
      contents: {
        longitudinalPdf: true,
        consentCount: consents.length,
        attachmentCount: attachments.length,
      },
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        encounterId: attachment.encounter.id,
        encounterStatus: attachment.encounter.status,
        uploadedAt: attachment.uploadedAt,
        originalName: attachment.originalName,
        mime: attachment.mime,
        size: attachment.size,
        category: attachment.category,
        description: attachment.description,
        archivePath: `adjuntos/${this.buildEncounterFolderName(attachment)}/${this.buildAttachmentEntryName(attachment)}`,
      })),
    };

    const buffer = await this.createArchiveBuffer({
      longitudinalPdf,
      consents,
      attachments,
      manifest,
      warnings,
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'EXPORT',
      reason: 'PATIENT_BUNDLE_EXPORTED',
      diff: {
        export: {
          type: 'bundle_zip',
          patientId,
          consentCount: consents.length,
          attachmentCount: attachments.length,
          warningCount: warnings.length,
        },
      },
    });

    return {
      buffer,
      filename: this.buildBundleFilename(scopedPatient.nombre),
    };
  }
}