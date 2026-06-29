import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEGAL_DOCUMENT_TYPES, type LegalDocumentContentJson } from '../../../../shared/legal-contract';

const LEGAL_DOCUMENT_TYPE_VALUES = [...LEGAL_DOCUMENT_TYPES];

export class CreateLegalDocumentDraftDto {
  @IsIn(LEGAL_DOCUMENT_TYPE_VALUES)
  type!: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @IsOptional()
  @IsObject()
  contentJson?: LegalDocumentContentJson;
}

export class UpdateLegalDocumentDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @IsOptional()
  @IsObject()
  contentJson?: LegalDocumentContentJson;
}
