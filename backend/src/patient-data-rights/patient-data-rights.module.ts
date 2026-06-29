import { Module } from '@nestjs/common';
import { PatientDataRightsService } from './patient-data-rights.service';
import { PatientDataRightsController } from './patient-data-rights.controller';
import { PatientNotBlockedGuard } from './patient-not-blocked.guard';
import { PatientDataRequestDeliveryService } from './patient-data-request-delivery.service';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [AuditModule, MailModule, PatientsModule],
  controllers: [PatientDataRightsController],
  providers: [PatientDataRightsService, PatientDataRequestDeliveryService, PatientNotBlockedGuard],
  exports: [PatientDataRightsService, PatientNotBlockedGuard],
})
export class PatientDataRightsModule {}
