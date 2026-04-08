import { PartialType } from '@nestjs/mapped-types';
import { UpsertPatientProblemDto } from './upsert-patient-problem.dto';

export class UpdatePatientProblemDto extends PartialType(UpsertPatientProblemDto) {}