import { IsDateString, IsInt, IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import { Prevision, PREVISIONES, Sexo, SEXOS } from '../../common/types';

export class UpdatePatientAdminDto {
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida' })
  @IsOptional()
  fechaNacimiento?: string | null;

  @IsInt()
  @Min(0, { message: 'La edad debe ser mayor a 0' })
  @Max(150, { message: 'La edad no puede ser mayor a 150' })
  @IsOptional()
  edad?: number | null;

  @IsInt()
  @Min(0)
  @Max(11)
  @IsOptional()
  edadMeses?: number | null;

  @IsIn(SEXOS, { message: 'El sexo debe ser válido' })
  @IsOptional()
  sexo?: Sexo | null;

  @IsIn(PREVISIONES, { message: 'La previsión debe ser válida' })
  @IsOptional()
  prevision?: Prevision | null;

  @IsString()
  @IsOptional()
  trabajo?: string | null;

  @IsString()
  @IsOptional()
  domicilio?: string | null;
}
