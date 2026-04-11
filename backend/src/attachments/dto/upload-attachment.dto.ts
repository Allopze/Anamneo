import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  linkedOrderType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  linkedOrderId?: string;
}
