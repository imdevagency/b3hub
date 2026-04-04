import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum FreightVehicleType {
  TIPPER_SMALL = 'TIPPER_SMALL', // 10 t / 8 m³
  TIPPER_LARGE = 'TIPPER_LARGE', // 18 t / 12 m³
  ARTICULATED_TIPPER = 'ARTICULATED_TIPPER', // 26 t / 22 m³
  FLATBED = 'FLATBED', // 20 t flatbed / open trailer
  BOX_TRUCK = 'BOX_TRUCK', // 3.5 t enclosed box truck
}

export class CreateFreightOrderDto {
  // ── Pickup ────────────────────────────────────────────────────────────────
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

  // ── Dropoff ───────────────────────────────────────────────────────────────
  @IsString()
  dropoffAddress!: string;

  @IsString()
  dropoffCity!: string;

  @IsString()
  @IsOptional()
  dropoffState?: string;

  @IsString()
  @IsOptional()
  dropoffPostal?: string;

  @IsNumber()
  @IsOptional()
  dropoffLat?: number;

  @IsNumber()
  @IsOptional()
  dropoffLng?: number;

  // ── Cargo ────────────────────────────────────────────────────────────────
  @IsEnum(FreightVehicleType)
  vehicleType!: FreightVehicleType;

  @IsString()
  loadDescription!: string;

  @IsNumber()
  @Min(0.1)
  @IsOptional()
  estimatedWeight?: number; // tonnes

  // ── Timing ───────────────────────────────────────────────────────────────
  @IsString()
  requestedDate!: string; // ISO date string
}
