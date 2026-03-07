import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory, MaterialUnit } from '@prisma/client';

export class CreateQuoteRequestDto {
  @IsEnum(MaterialCategory)
  materialCategory: MaterialCategory;

  @IsString()
  materialName: string;

  @IsNumber()
  @Min(0.1)
  @Type(() => Number)
  quantity: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsString()
  deliveryAddress: string;

  @IsString()
  deliveryCity: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  deliveryLat?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  deliveryLng?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
