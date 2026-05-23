import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateOnboardingProgressDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  completedStepIds?: string[];

  @IsBoolean()
  @IsOptional()
  dismissed?: boolean;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
