import {
  IsString,
  IsDateString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsInt,
  Min,
  MinLength,
  IsIn,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateToiletCabinDto {
  /** Street address for delivery */
  @IsString()
  @MinLength(5)
  address: string;

  /** City name */
  @IsString()
  @MinLength(2)
  city: string;

  /** Geocoded latitude */
  @IsOptional()
  @IsNumber()
  lat?: number;

  /** Geocoded longitude */
  @IsOptional()
  @IsNumber()
  lng?: number;

  /** Number of cabin units */
  @IsInt()
  @Min(1)
  cabinCount: number;

  /** Hire period in days */
  @IsInt()
  @Min(1)
  hireDays: number;

  /** ISO date string for desired delivery */
  @IsDateString()
  deliveryDate: string;

  /** Preferred pickup window */
  @IsOptional()
  @IsIn(['AM', 'PM', 'ANY'])
  deliveryWindow?: string;

  /** Payment method */
  @IsOptional()
  @IsString()
  paymentMethod?: PaymentMethod;

  // ── Optional contact info (guest orders) ───────────────────

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
