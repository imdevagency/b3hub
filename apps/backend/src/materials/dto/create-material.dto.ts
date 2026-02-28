import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { MaterialCategory, MaterialUnit } from '@prisma/client';

export class CreateMaterialDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(MaterialCategory)
  category: MaterialCategory;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  minOrder?: number;

  @IsOptional()
  @IsNumber()
  maxOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRecycled?: boolean;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  specifications?: any;

  @IsString()
  supplierId: string;
}
