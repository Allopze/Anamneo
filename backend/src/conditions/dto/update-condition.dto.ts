import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateConditionDto } from './create-condition.dto';

export class UpdateConditionDto extends PartialType(CreateConditionDto) {
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
