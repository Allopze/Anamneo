import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PatientsService } from './patients.service';
import { PatientsExportBundleService } from './patients-export-bundle.service';
import { PatientsRegulatoryExportService } from './patients-regulatory-export.service';
import { PatientsRegulatoryPurgeService } from './patients-regulatory-purge.service';
import { PatientsBlockingService } from './patients-blocking.service';
import { PatientsPdfService } from './patients-pdf.service';
import { PatientsController } from './patients.controller';
import { PatientsManagementController } from './patients-management.controller';
import { PatientsAuxController } from './patients-aux.controller';
import { PatientsRegulatoryController } from './patients-regulatory.controller';
import { AuditModule } from '../audit/audit.module';
import { ConsentsModule } from '../consents/consents.module';
import { SettingsModule } from '../settings/settings.module';
import { PatientConsentsModule } from '../patient-consents/patient-consents.module';

@Module({
  imports: [AuditModule, ConfigModule, ConsentsModule, SettingsModule, PatientConsentsModule],
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
    PatientsBlockingService,
  ],
  exports: [
    PatientsService,
    PatientsRegulatoryExportService,
    PatientsBlockingService,
  ],
})
export class PatientsModule {}
