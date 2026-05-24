import { Module } from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { ConsentsController } from './consents.controller';
import { AuditModule } from '../audit/audit.module';
import { PatientNotBlockedGuard } from '../patient-data-rights/patient-not-blocked.guard';

@Module({
  imports: [AuditModule],
  controllers: [ConsentsController],
  providers: [ConsentsService, PatientNotBlockedGuard],
  exports: [ConsentsService],
})
export class ConsentsModule {}
