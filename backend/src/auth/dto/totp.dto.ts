import { IsString, Length } from 'class-validator';

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
  @Length(6, 6)
  code: string;
}
