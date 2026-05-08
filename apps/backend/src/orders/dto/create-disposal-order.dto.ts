import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { WasteType } from '@prisma/client';

export enum DisposalTruckType {
  TIPPER_SMALL = 'TIPPER_SMALL', // 10 t / 8 m³
  TIPPER_LARGE = 'TIPPER_LARGE', // 18 t / 12 m³
  ARTICULATED_TIPPER = 'ARTICULATED_TIPPER', // 26 t / 18 m³
}

export class CreateDisposalOrderDto {
  @IsString()
  pickupAddress!: string;

  @IsString()
  pickupCity!: string;

  @IsString()
  @IsOptional()
  pickupState?: string;

  @IsString()
  @IsOptional()
  pickupPostal?: string;

  @IsNumber()
  @IsOptional()
  pickupLat?: number;

  @IsNumber()
  @IsOptional()
  pickupLng?: number;

  @IsEnum(WasteType)
  wasteType!: WasteType;

  @IsEnum(DisposalTruckType)
  truckType!: DisposalTruckType;

  @IsInt()
  @Min(1)
  truckCount!: number;

  @IsNumber()
  @Min(0.1)
  estimatedWeight!: number; // tonnes

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  requestedDate!: string; // ISO date string

  @IsString()
  @IsIn(['AM', 'PM', 'ANY'])
  @IsOptional()
  pickupWindow?: string;

  @IsString()
  @IsOptional()
  siteContactName?: string;

  @IsString()
  @IsOptional()
  siteContactPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** BIS (Būvniecības informācijas sistēma) case reference for construction-site waste disposal. */
  @IsString()
  @IsOptional()
  bisNumber?: string;

  /** Who is responsible for loading the waste onto the truck. */
  @IsString()
  @IsIn(['BUYER_CREW', 'DRIVER_HANDS', 'NEEDS_MACHINERY'])
  @IsOptional()
  loadingBy?: string;

  /** Whether the site contact will be physically present during the pickup window. */
  @IsBoolean()
  @IsOptional()
  contactWillBePresent?: boolean;

  /** Readiness of the waste at the pickup site. */
  @IsString()
  @IsIn(['PILED', 'NEEDS_PREP'])
  @IsOptional()
  wasteReadiness?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quotedRate?: number; // EUR, incl. platform fee, excl. VAT

  @IsUUID()
  @IsOptional()
  projectId?: string; // optional project tag for P&L roll-up

  /** Buyer-selected recycling centre override. When provided, the disposal job
   *  is routed to this centre instead of the nearest available one. */
  @IsUUID()
  @IsOptional()
  preferredRecyclingCenterId?: string;

  /** B3 Field destination for waste utilization orders. When provided, the
   *  waste is routed to this physical B3 Field location. The backend resolves
   *  the linked recycling centre automatically if one is configured. */
  @IsUUID()
  @IsOptional()
  destinationB3FieldId?: string;

  /** True when the buyer expects a buyback payout from the recycler (scrap metal flow).
   *  When set, the order total is €0 and buyerPayoutAmount records the expected payout. */
  @IsOptional()
  buybackPricePerTonne?: number; // EUR/t — agreed buyback rate; used to calculate buyerPayoutAmount
}
