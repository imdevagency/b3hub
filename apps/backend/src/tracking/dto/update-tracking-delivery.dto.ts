import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload for the public PATCH /track/:token/delivery endpoint.
 * Used by a foreman (or any link-holder) to fill in delivery details
 * on a draft/pending order without needing an account.
 */
export class UpdateTrackingDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryPostal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  siteContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
