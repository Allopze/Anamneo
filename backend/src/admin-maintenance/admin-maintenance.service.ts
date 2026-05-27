import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuditService } from '../audit/audit.service';
import { AuthPasswordResetService } from '../auth/auth-password-reset.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { rebuildPatientClinicalSearchProjection } from '../patients/patient-clinical-search-projection';
import { AdminMaintenanceDto } from './dto/admin-maintenance.dto';
import { assertFineGrainedAction } from '../common/utils/fine-grained-permissions';

export const ADMIN_MAINTENANCE_CONFIRMATIONS = {
  purgeExpiredPasswordResetTokens: 'PURGAR TOKENS RESET EXPIRADOS',
  purgeDeletedAttachments: 'PURGAR ADJUNTOS ELIMINADOS VENCIDOS',
  rebuildClinicalSearch: 'RECONSTRUIR INDICE CLINICO',
  auditLegacyPlaintext: 'AUDITAR PLAINTEXT LEGACY',
} as const;

type MaintenanceAction = keyof typeof ADMIN_MAINTENANCE_CONFIRMATIONS;

@Injectable()
export class AdminMaintenanceService {
  private readonly logger = new Logger(AdminMaintenanceService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private attachmentsService: AttachmentsService,
    private configService: ConfigService,
    private authPasswordResetService: AuthPasswordResetService,
  ) {}

  private getPasswordResetTokenRetention() {
    const retentionDays = this.configService.get<number>('PASSWORD_RESET_TOKEN_RETENTION_DAYS', 7);
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - maxAgeMs);
    return { retentionDays, maxAgeMs, cutoff };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    disabled: process.env.NODE_ENV === 'test' || process.env.ADMIN_MAINTENANCE_CRON_DISABLED === 'true',
  })
  async purgeExpiredPasswordResetTokensCron() {
    const { retentionDays, maxAgeMs } = this.getPasswordResetTokenRetention();
    const deleted = await this.authPasswordResetService.purgeExpiredTokens(maxAgeMs);
    if (deleted > 0) {
      this.logger.log(`Purga programada de password reset tokens elimino ${deleted} registros (retencion ${retentionDays} dias)`);
    }
  }

  async purgeExpiredPasswordResetTokens(user: CurrentUserData, dto: AdminMaintenanceDto) {
    await this.assertConfirmed(user, 'purgeExpiredPasswordResetTokens', dto);

    const { retentionDays, maxAgeMs, cutoff } = this.getPasswordResetTokenRetention();
    const deleted = await this.authPasswordResetService.purgeExpiredTokens(maxAgeMs);

    const summary = {
      action: 'purgeExpiredPasswordResetTokens',
      deleted,
      retentionDays,
      cutoff: cutoff.toISOString(),
    };
    await this.logSuccess(user, dto, summary);
    return summary;
  }

  async purgeDeletedAttachments(user: CurrentUserData, dto: AdminMaintenanceDto) {
    await this.assertConfirmed(user, 'purgeDeletedAttachments', dto);

    const result = await this.attachmentsService.purgeExpiredAttachments();
    const summary = {
      action: 'purgeDeletedAttachments',
      purged: result.purged,
      errors: result.errors,
    };
    await this.logSuccess(user, dto, summary);
    return summary;
  }

  async rebuildClinicalSearch(user: CurrentUserData, dto: AdminMaintenanceDto) {
    await this.assertConfirmed(user, 'rebuildClinicalSearch', dto);

    const pairs = await this.prisma.encounter.findMany({
      distinct: ['patientId', 'medicoId'],
      select: { patientId: true, medicoId: true },
    });

    await this.prisma.patientClinicalSearch.deleteMany();
    let rebuilt = 0;
    for (const pair of pairs) {
      await rebuildPatientClinicalSearchProjection(this.prisma, pair);
      rebuilt++;
    }

    const summary = {
      action: 'rebuildClinicalSearch',
      patientMedicoPairs: pairs.length,
      rebuilt,
    };
    await this.logSuccess(user, dto, summary);
    return summary;
  }

  async auditLegacyPlaintext(user: CurrentUserData, dto: AdminMaintenanceDto) {
    await this.assertConfirmed(user, 'auditLegacyPlaintext', dto);

    const forbiddenColumns = [
      ['patients', 'rut'],
      ['patients', 'nombre'],
      ['patients', 'telefono'],
      ['patients', 'email'],
      ['patients', 'domicilio'],
      ['patients', 'contacto_emergencia_nombre'],
      ['patients', 'contacto_emergencia_telefono'],
      ['patients', 'legal_representative_name'],
      ['patients', 'legal_representative_rut'],
      ['patients', 'legal_representative_relationship'],
      ['patients', 'legal_representative_contact'],
      ['patient_data_processing_consents', 'signer_name'],
      ['patient_data_processing_consents', 'signer_rut'],
      ['patient_data_requests', 'requester_rut'],
      ['patient_data_requests', 'requester_email'],
    ];

    const rows = await this.prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND (table_name, column_name) IN (${forbiddenColumns
           .map(([table, column]) => `('${table}', '${column}')`)
           .join(', ')})
       ORDER BY table_name, column_name`,
    );

    const summary = {
      action: 'auditLegacyPlaintext',
      legacyPlaintextColumnsPresent: rows.map((row) => `${row.table_name}.${row.column_name}`),
      status: rows.length === 0 ? 'PASS' : 'REVIEW_REQUIRED',
    };
    await this.logSuccess(user, dto, summary);
    return summary;
  }

  private async assertConfirmed(
    user: CurrentUserData,
    action: MaintenanceAction,
    dto: AdminMaintenanceDto,
  ) {
    const expected = ADMIN_MAINTENANCE_CONFIRMATIONS[action];
    assertFineGrainedAction(user, 'admin.maintenance', 'No tiene permisos para ejecutar mantenimiento administrativo');

    if (dto.confirmation === expected) return;

    await this.auditService.log({
      entityType: 'AdminMaintenance',
      entityId: action,
      userId: user.id,
      action: 'UPDATE',
      reason: 'ADMIN_MAINTENANCE_EXECUTED',
      result: 'REJECTED',
      diff: {
        action,
        reason: dto.reason,
        rejected: 'confirmation_mismatch',
      },
    });
    throw new BadRequestException(`Confirmacion invalida. Escriba exactamente: ${expected}`);
  }

  private async logSuccess(user: CurrentUserData, dto: AdminMaintenanceDto, summary: object) {
    await this.auditService.log({
      entityType: 'AdminMaintenance',
      entityId: (summary as { action?: string }).action ?? 'maintenance',
      userId: user.id,
      action: 'UPDATE',
      reason: 'ADMIN_MAINTENANCE_EXECUTED',
      diff: {
        reason: dto.reason,
        summary,
      },
    });
  }
}
