import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMedicationDto } from './create-medication.dto';

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}