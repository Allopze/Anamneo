import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  @MaxLength(2048, { message: 'Token demasiado largo' })
  refreshToken?: string;
}
