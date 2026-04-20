import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMedicationDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(300, { message: 'El nombre no puede exceder 300 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @MinLength(2, { message: 'El principio activo debe tener al menos 2 caracteres' })
  @MaxLength(300, { message: 'El principio activo no puede exceder 300 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  activeIngredient: string;
}