import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WasteType } from '@prisma/client';

export class DisposalQuoteQueryDto {
  @IsEnum(WasteType)
  wasteType: WasteType;

  /** Weight in kilograms */
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weightKg: number;

  /** Buyer's pickup location latitude (for distance calculation) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  /** Buyer's pickup location longitude */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
