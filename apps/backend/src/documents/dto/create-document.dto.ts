import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DocumentType,
  DocumentStatus,
  DocumentEntityType,
  DocumentLinkRole,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateDocumentLinkDto {
  @IsEnum(DocumentEntityType)
  entityType: DocumentEntityType;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsEnum(DocumentLinkRole)
  role?: DocumentLinkRole;
}

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  transportJobId?: string;

  @IsOptional()
  @IsString()
  wasteRecordId?: string;

  @IsOptional()
  @IsString()
  skipHireId?: string;

  @IsOptional()
  @IsString()
  issuedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentLinkDto)
  links?: CreateDocumentLinkDto[];
}
