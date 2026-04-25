import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyTotpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class DisableTotpDto {
  @IsString()
  password: string;
}

export class VerifyTotpLoginDto {
  @IsString()
  tempToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code: string;
}

export class RegenerateRecoveryCodesDto {
  @IsString()
  password: string;
}
