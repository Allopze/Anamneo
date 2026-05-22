import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PatientsRegulatoryExportService } from './patients-regulatory-export.service';
import { RequestUser } from '../common/utils/medico-id';

const DEFAULT_PURGE_MIN_AGE_DAYS = 5475; // 15 anios

export interface RegulatoryPurgeInput {
  confirmation?: string;
  justification?: string;
  bypassRetention?: boolean;
}

@Injectable()
export class PatientsRegulatoryPurgeService {
  private readonly logger = new Logger(PatientsRegulatoryPurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly exportService: PatientsRegulatoryExportService,
  ) {}

  async purgePatient(patientId: string, user: RequestUser, input: RegulatoryPurgeInput): Promise<{
    purged: true;
    patientId: string;
    snapshotPath: string;
    deletedAt: string;
  }> {
    if (input.confirmation !== 'PURGE-REGULATORY') {
      throw new BadRequestException('Debe enviar confirmation="PURGE-REGULATORY" para confirmar el borrado regulatorio');
    }
    const justification = (input.justification || '').trim();
    if (justification.length < 16) {
      throw new BadRequestException('La justificación regulatoria debe tener al menos 16 caracteres');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, archivedAt: true, nombre: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!patient.archivedAt) {
      throw new BadRequestException('Solo se permite borrado regulatorio sobre pacientes archivados (soft-deleted)');
    }

    if (!input.bypassRetention) {
      const minAgeDays = this.configService.get<number>('PATIENT_PURGE_MIN_AGE_DAYS') ?? DEFAULT_PURGE_MIN_AGE_DAYS;
      const minAgeMs = minAgeDays * 24 * 60 * 60 * 1000;
      const ageMs = Date.now() - patient.archivedAt.getTime();
      if (ageMs < minAgeMs) {
        const remainingDays = Math.ceil((minAgeMs - ageMs) / (24 * 60 * 60 * 1000));
        throw new BadRequestException(
          `Retención regulatoria pendiente: faltan ${remainingDays} día(s) para purgar (mínimo configurado: ${minAgeDays}d). `
          + 'Para casos extraordinarios usar bypassRetention=true con justificación adicional.',
        );
      }
    }

    // Snapshot defensivo antes de cualquier delete. Si falla, abortamos.
    const snapshotPath = await this.exportService.snapshotForPurge(patientId, user);

    // Auditar la intencion ANTES de borrar; usa AuditLog cadena.
    await this.auditService.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'DELETE',
      reason: 'PATIENT_RECORD_PURGED_REGULATORY',
      diff: {
        scope: 'REGULATORY_PURGE',
        patientId,
        snapshotPath,
        justification,
        bypassRetention: !!input.bypassRetention,
      },
    });

    // Cascade delete: Prisma respeta los onDelete: Cascade del schema para los
    // children directos. Para hijos transitivos (e.g. EncounterSection a traves
    // de Encounter, attachments, etc.) tambien se cascadea por el schema actual.
    await this.prisma.patient.delete({ where: { id: patientId } });

    return {
      purged: true,
      patientId,
      snapshotPath,
      deletedAt: new Date().toISOString(),
    };
  }
}
