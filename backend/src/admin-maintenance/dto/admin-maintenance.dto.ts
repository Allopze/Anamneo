import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminMaintenanceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  confirmation!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
