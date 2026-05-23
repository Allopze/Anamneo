import { Module } from '@nestjs/common';
import { PatientConsentsService } from './patient-consents.service';
import { PatientConsentsController } from './patient-consents.controller';
import { PolicyComplianceService } from './policy-compliance.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PatientConsentsController],
  providers: [PatientConsentsService, PolicyComplianceService],
  exports: [PatientConsentsService, PolicyComplianceService],
})
export class PatientConsentsModule {}
