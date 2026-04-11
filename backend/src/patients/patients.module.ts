import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsPdfService } from './patients-pdf.service';
import { PatientsController } from './patients.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsPdfService],
  exports: [PatientsService],
})
export class PatientsModule {}
