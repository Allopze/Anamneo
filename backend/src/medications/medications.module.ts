import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { MedicationsCsvService } from './medications-csv.service';
import { MedicationsService } from './medications.service';

@Module({
  controllers: [MedicationsController],
  providers: [MedicationsService, MedicationsCsvService],
  exports: [MedicationsService, MedicationsCsvService],
})
export class MedicationsModule {}