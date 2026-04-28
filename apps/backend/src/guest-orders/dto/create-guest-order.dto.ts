import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGuestOrderDto {
  // ── Category discriminator ─────────────────────────────────────────────────
  /** MATERIAL | SKIP_HIRE | TRANSPORT | DISPOSAL — defaults to MATERIAL */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  category?: string;

  // ── MATERIAL fields ───────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(50)
  materialCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10_000)
  quantity?: number;

  /** TONNE | M3 | KG | PIECE */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  // ── SKIP_HIRE fields ──────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(30)
  skipSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  skipWasteCategory?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  hireDays?: number;

  @IsOptional()
  @IsString()
  collectionDate?: string; // ISO date string

  // ── TRANSPORT fields ──────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupCity?: string;

  @IsOptional()
  @IsNumber()
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  pickupLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cargoDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  estimatedWeight?: number;

  // ── DISPOSAL fields ───────────────────────────────────────────────────────
  /** JSON array string, e.g. '["CONCRETE","SOIL"]' */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  wasteTypes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  disposalVolume?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  truckType?: string;

  // ── Where (delivery / dropoff / placement) ────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  deliveryAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deliveryCity: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  deliveryPostal?: string;

  @IsOptional()
  @IsNumber()
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  deliveryLng?: number;

  // ── When ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  deliveryDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryWindow?: string; // e.g. "08:00-12:00"

  // ── Who (guest contact — no account required) ─────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'contactPhone must be a valid phone number',
  })
  contactPhone: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
