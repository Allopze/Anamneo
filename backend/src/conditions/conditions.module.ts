import { Module } from '@nestjs/common';
import { ConditionsCsvService } from './conditions-csv.service';
import { ConditionsService } from './conditions.service';
import { ConditionsSimilarityService } from './conditions-similarity.service';
import { ConditionsController } from './conditions.controller';

@Module({
  controllers: [ConditionsController],
  providers: [ConditionsService, ConditionsSimilarityService, ConditionsCsvService],
  exports: [ConditionsService, ConditionsSimilarityService, ConditionsCsvService],
})
export class ConditionsModule {}
