import {
  IsEmail,
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
  // ── What ──────────────────────────────────────────────────────────────────
  /** Mirrors MaterialCategory enum values, plus SKIP_HIRE and TRANSPORT for those wizard types */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  materialCategory: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  materialName: string;

  @IsNumber()
  @Min(0.1)
  @Max(10_000)
  quantity: number;

  /** TONNE | M3 | KG | PIECE */
  @IsString()
  @IsNotEmpty()
  unit: string;

  // ── Where ─────────────────────────────────────────────────────────────────
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
