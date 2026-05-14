import { IsEnum, IsString, IsNumber, IsOptional, IsInt, Min, IsIn, IsObject, IsArray } from 'class-validator';
import { RentalServiceType, PaymentMethod } from '@prisma/client';

export class CreateRentalOrderDto {
  /** Marketplace listing — when set, serviceType/price are resolved from the listing */
  @IsOptional()
  @IsString()
  listingId?: string;

  @IsEnum(RentalServiceType)
  serviceType: RentalServiceType;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsInt()
  @Min(1)
  hireDays: number;

  @IsString()
  deliveryDate: string; // ISO date string

  @IsOptional()
  @IsIn(['AM', 'PM', 'ANY'])
  deliveryWindow?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Service-specific configuration (e.g. { heightMetres: 6 } for scaffolding) */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // ── Add-ons & insurance selections ───────────────────────────────────────

  /** Snapshot of selected add-ons — [{ id, name, pricePerDay?, priceFlat?, qty }] */
  @IsOptional()
  @IsArray()
  selectedAddOns?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  insurancePlanId?: string;

  @IsOptional()
  @IsString()
  insurancePlanName?: string;

  @IsOptional()
  @IsNumber()
  insurancePricePerDay?: number;

  // ── Pricing breakdown ────────────────────────────────────────────────────

  @IsOptional()
  @IsNumber()
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;
}
