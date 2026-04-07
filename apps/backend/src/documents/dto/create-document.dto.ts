import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
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
  @MaxLength(300)
  title: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20 * 1024 * 1024) // 20 MB hard cap
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
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentLinkDto)
  links?: CreateDocumentLinkDto[];
}
