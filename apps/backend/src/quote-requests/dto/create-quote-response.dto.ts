import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialUnit } from '@prisma/client';

export class CreateQuoteResponseDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerUnit: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  etaDays: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsISO8601()
  @IsOptional()
  validUntil?: string;
}
