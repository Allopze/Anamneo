import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PatientsService } from './patients.service';
import { PatientsExportBundleService } from './patients-export-bundle.service';
import { PatientsPdfService } from './patients-pdf.service';
import { PatientsController } from './patients.controller';
import { AuditModule } from '../audit/audit.module';
import { ConsentsModule } from '../consents/consents.module';

@Module({
  imports: [AuditModule, ConfigModule, ConsentsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsPdfService, PatientsExportBundleService],
  exports: [PatientsService],
})
export class PatientsModule {}
