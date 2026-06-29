import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { PatientNotBlockedGuard } from '../patient-data-rights/patient-not-blocked.guard';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, PatientNotBlockedGuard],
  exports: [AlertsService],
})
export class AlertsModule {}
