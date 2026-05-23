import { Module } from '@nestjs/common';
import { PatientDataRightsService } from './patient-data-rights.service';
import { PatientDataRightsController } from './patient-data-rights.controller';
import { PatientNotBlockedGuard } from './patient-not-blocked.guard';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AuditModule, MailModule],
  controllers: [PatientDataRightsController],
  providers: [PatientDataRightsService, PatientNotBlockedGuard],
  exports: [PatientDataRightsService, PatientNotBlockedGuard],
})
export class PatientDataRightsModule {}
