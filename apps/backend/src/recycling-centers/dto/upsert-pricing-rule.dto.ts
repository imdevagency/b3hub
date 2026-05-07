import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { WasteType } from '@prisma/client';

export class UpsertPricingRuleDto {
  @IsEnum(WasteType)
  wasteType: WasteType;

  @IsNumber()
  @Min(0)
  pricePerTonne: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumWeight?: number;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  /** EUR per tonne the center pays to the buyer (scrap metal buyback). Null = no buyback. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  buybackPricePerTonne?: number;
}
