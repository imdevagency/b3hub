import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string; // "t", "m³", "gab."

  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQty?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockQty?: number;

  @IsBoolean()
  @IsOptional()
  available?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {}
