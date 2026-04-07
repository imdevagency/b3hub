import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MaterialCategory, MaterialUnit } from '@prisma/client';

export class CreateMaterialDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(MaterialCategory)
  category: MaterialCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subCategory?: string;

  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  basePrice: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRecycled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quality?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  certificates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  images?: string[];

  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @IsString()
  supplierId: string;
}
