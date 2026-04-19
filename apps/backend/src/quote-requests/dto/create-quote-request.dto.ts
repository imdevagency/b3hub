import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory, MaterialUnit } from '@prisma/client';

export class CreateQuoteRequestDto {
  @IsEnum(MaterialCategory)
  materialCategory: MaterialCategory;

  @IsString()
  @MaxLength(200)
  materialName: string;

  @IsNumber()
  @Min(0.1)
  @Max(1_000_000)
  @Type(() => Number)
  quantity: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsString()
  @MaxLength(300)
  deliveryAddress: string;

  @IsString()
  @MaxLength(100)
  deliveryCity: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  deliveryLat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  deliveryLng?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
