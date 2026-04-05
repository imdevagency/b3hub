import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, PaymentStatus, MaterialUnit } from '@prisma/client';

class OrderItemDto {
  @IsString()
  materialId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(MaterialUnit)
  unit: MaterialUnit;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  orderType: OrderType;

  @IsOptional()
  @IsString()
  buyerId?: string;

  @IsString()
  deliveryAddress: string;

  @IsString()
  deliveryCity: string;

  @IsOptional()
  @IsString()
  deliveryState?: string;

  @IsOptional()
  @IsString()
  deliveryPostal?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  deliveryLng?: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  siteContactName?: string;

  @IsOptional()
  @IsString()
  siteContactPhone?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  /** Number of trucks to dispatch (default 1). Each truck becomes a separate transport job. */
  @IsOptional()
  @IsInt()
  @Min(1)
  truckCount?: number;

  /**
   * Minutes between consecutive truck departures when truckCount > 1.
   * Null / omitted means all trucks depart at the same time.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  truckIntervalMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

/** Create a recurring order schedule */
export class CreateOrderScheduleDto {
  @IsEnum(OrderType)
  orderType: OrderType;

  @IsString()
  deliveryAddress: string;

  @IsString()
  deliveryCity: string;

  @IsString()
  deliveryState: string;

  @IsString()
  deliveryPostal: string;

  @IsOptional()
  @IsString()
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  siteContactName?: string;

  @IsOptional()
  @IsString()
  siteContactPhone?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  /** Items snapshot: [{materialId, quantity, unit}] */
  @IsArray()
  items: { materialId: string; quantity: number; unit: string }[];

  /** Repeat interval in days: 7 = weekly, 14 = fortnightly, 30 = monthly */
  @IsInt()
  @Min(1)
  intervalDays: number;

  /** ISO date string for next run (defaults to tomorrow if omitted) */
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  /** Optional end date; omit for indefinite */
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
