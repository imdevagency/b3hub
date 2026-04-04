import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ProjectSiteType } from '@prisma/client';

export class CreateProjectSiteDto {
  @IsString()
  label!: string;

  @IsString()
  address!: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsEnum(ProjectSiteType)
  @IsOptional()
  type?: ProjectSiteType;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
