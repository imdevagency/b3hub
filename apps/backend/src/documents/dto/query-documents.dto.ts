import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType, DocumentStatus } from '@prisma/client';

export class QueryDocumentsDto {
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
