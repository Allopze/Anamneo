import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUserInvitationDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  email: string;

  @IsString({ message: 'Debe ingresar un rol válido' })
  @IsIn(['MEDICO', 'ASISTENTE', 'ADMIN'], { message: 'Solo se pueden invitar médicos, asistentes o administradores' })
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';

  @IsOptional()
  @IsUUID('4', { message: 'Debe seleccionar un médico válido' })
  medicoId?: string;
}
