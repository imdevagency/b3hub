import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  DocumentType,
  DocumentStatus,
  DocumentEntityType,
} from '@prisma/client';

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

  @IsOptional()
  @IsEnum(DocumentEntityType)
  entityType?: DocumentEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;
}
