import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TransportExceptionType } from '@prisma/client';

export class ReportTransportExceptionDto {
  @IsEnum(TransportExceptionType)
  type: TransportExceptionType;

  @IsString()
  @MaxLength(1000)
  notes: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  /** Optional operator hint that this needs dispatcher attention */
  @IsOptional()
  @IsBoolean()
  requiresDispatchAction?: boolean;

  /**
   * Required when type = PARTIAL_DELIVERY.
   * The actual quantity delivered, in the same unit as the order items (e.g. tonnes).
   * Used to proportionally reduce the order total and update the Stripe authorization.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualQuantity?: number;
}

export class ResolveTransportExceptionDto {
  @IsString()
  @MaxLength(1000)
  resolution: string;
}
