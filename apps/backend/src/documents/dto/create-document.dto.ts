import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { DocumentType, DocumentStatus } from '@prisma/client';

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
}
