import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PatientsService } from './patients.service';
import { PatientsExportBundleService } from './patients-export-bundle.service';
import { PatientsRegulatoryExportService } from './patients-regulatory-export.service';
import { PatientsRegulatoryPurgeService } from './patients-regulatory-purge.service';
import { PatientsPdfService } from './patients-pdf.service';
import { PatientsController } from './patients.controller';
import { PatientsManagementController } from './patients-management.controller';
import { PatientsAuxController } from './patients-aux.controller';
import { PatientsRegulatoryController } from './patients-regulatory.controller';
import { AuditModule } from '../audit/audit.module';
import { ConsentsModule } from '../consents/consents.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, ConfigModule, ConsentsModule, SettingsModule],
  controllers: [
    PatientsController,
    PatientsManagementController,
    PatientsAuxController,
    PatientsRegulatoryController,
  ],
  providers: [
    PatientsService,
    PatientsPdfService,
    PatientsExportBundleService,
    PatientsRegulatoryExportService,
    PatientsRegulatoryPurgeService,
  ],
  exports: [PatientsService],
})
export class PatientsModule {}
