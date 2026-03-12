import { Module } from '@nestjs/common';
import { ConditionsService } from './conditions.service';
import { ConditionsSimilarityService } from './conditions-similarity.service';
import { ConditionsController } from './conditions.controller';

@Module({
  controllers: [ConditionsController],
  providers: [ConditionsService, ConditionsSimilarityService],
  exports: [ConditionsService, ConditionsSimilarityService],
})
export class ConditionsModule {}
