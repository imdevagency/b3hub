import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BuContext, LeadSource, LeadStatus, LeadType } from '@prisma/client';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  linkedUserId?: string;

  @IsOptional()
  @IsString()
  linkedCompanyId?: string;

  @IsOptional()
  @IsEnum(LeadType)
  type?: LeadType;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(BuContext)
  buContext?: BuContext;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
