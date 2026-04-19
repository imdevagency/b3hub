import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Max,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, MaterialUnit, PaymentStatus } from '@prisma/client';

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
  @MaxLength(300)
  deliveryAddress: string;

  @IsString()
  @MaxLength(100)
  deliveryCity: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryPostal?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

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
  @MaxLength(300)
  deliveryAddress: string;

  @IsString()
  @MaxLength(100)
  deliveryCity: string;

  @IsString()
  @MaxLength(100)
  deliveryState: string;

  @IsString()
  @MaxLength(20)
  deliveryPostal: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

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
  projectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number;

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
