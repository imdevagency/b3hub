import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsEmail,
  MinLength,
} from 'class-validator';
import { SkipWasteCategory, SkipSize } from '@prisma/client';

export class CreateSkipHireDto {
  /** Postal code or city entered in step 1 */
  @IsString()
  @MinLength(2)
  location: string;

  /** Waste category selected in step 2 */
  @IsEnum(SkipWasteCategory)
  wasteCategory: SkipWasteCategory;

  /** Skip size selected in step 3 */
  @IsEnum(SkipSize)
  skipSize: SkipSize;

  /** ISO date string for desired delivery (step 4) */
  @IsDateString()
  deliveryDate: string;

  // ── Optional contact info (guest orders) ────────────────────

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
