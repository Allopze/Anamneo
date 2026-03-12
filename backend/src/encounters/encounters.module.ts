import { Module } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { EncountersPdfService } from './encounters-pdf.service';
import { EncountersController } from './encounters.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [EncountersController],
  providers: [EncountersService, EncountersPdfService],
  exports: [EncountersService],
})
export class EncountersModule {}
