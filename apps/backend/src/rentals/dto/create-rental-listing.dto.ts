import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsObject,
  IsPositive,
} from 'class-validator';
import { RentalServiceType } from '@prisma/client';

export class CreateRentalListingDto {
  @IsEnum(RentalServiceType)
  serviceType: RentalServiceType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  subCategoryLabel?: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unitLabel?: string;

  @IsOptional()
  @IsInt()
  yearOfManufacture?: number;

  // ── Pricing ───────────────────────────────────────────────────────────────

  @IsNumber()
  @IsPositive()
  pricePerDay: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minHireDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHireDays?: number;

  @IsOptional()
  @IsArray()
  hirePeriodOptions?: { days: number; label: string }[];

  @IsInt()
  @Min(1)
  quantityTotal: number;

  // ── Coverage ──────────────────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverageCities?: string[];

  @IsOptional()
  @IsNumber()
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  freeDeliveryRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  deliveryFeePerKm?: number;

  @IsOptional()
  @IsNumber()
  providerLat?: number;

  @IsOptional()
  @IsNumber()
  providerLng?: number;

  @IsOptional()
  @IsBoolean()
  selfCollectAvailable?: boolean;

  @IsOptional()
  @IsString()
  selfCollectAddress?: string;

  @IsOptional()
  @IsNumber()
  selfCollectLat?: number;

  @IsOptional()
  @IsNumber()
  selfCollectLng?: number;

  // ── Availability ──────────────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedDates?: string[];

  // ── Media & documents ────────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsObject()
  documentUrls?: Record<string, unknown>;

  // ── Technical specs ───────────────────────────────────────────────────────

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  // ── Add-ons & insurance ───────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  addOns?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  insuranceOptions?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  insuranceRequired?: boolean;

  // ── Policies ──────────────────────────────────────────────────────────────

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsString()
  depositMethod?: string;

  @IsOptional()
  @IsString()
  fuelPolicy?: string;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @IsOptional()
  @IsNumber()
  lateReturnFeePerDay?: number;

  @IsOptional()
  @IsObject()
  requiredDocuments?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
