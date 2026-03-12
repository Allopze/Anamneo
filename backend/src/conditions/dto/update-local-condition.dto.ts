import { PartialType } from '@nestjs/mapped-types';
import { CreateLocalConditionDto } from './create-local-condition.dto';

export class UpdateLocalConditionDto extends PartialType(CreateLocalConditionDto) {}
