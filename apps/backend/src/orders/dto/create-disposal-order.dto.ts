import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsIn,
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
}
