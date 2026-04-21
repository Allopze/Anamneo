import { IsUUID } from 'class-validator';

export class MergePatientDto {
  @IsUUID('4', { message: 'El paciente origen debe ser válido' })
  sourcePatientId: string;
}
