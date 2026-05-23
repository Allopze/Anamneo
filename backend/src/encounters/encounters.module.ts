import { forwardRef, Module } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { EncountersPdfService } from './encounters-pdf.service';
import { EncountersController } from './encounters.controller';
import { AuditModule } from '../audit/audit.module';
import { AlertsModule } from '../alerts/alerts.module';
import { SettingsModule } from '../settings/settings.module';
import { PatientDataRightsModule } from '../patient-data-rights/patient-data-rights.module';
import { PatientConsentsModule } from '../patient-consents/patient-consents.module';

@Module({
  imports: [
    AuditModule,
    AlertsModule,
    SettingsModule,
    forwardRef(() => PatientDataRightsModule),
    PatientConsentsModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService, EncountersPdfService],
  exports: [EncountersService, EncountersPdfService],
})
export class EncountersModule {}
