import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
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

  @IsString()
  buyerId: string;

  @IsString()
  deliveryAddress: string;

  @IsString()
  deliveryCity: string;

  @IsString()
  deliveryState: string;

  @IsString()
  deliveryPostal: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  deliveryWindow?: string;

  @IsNumber()
  @Min(0)
  deliveryFee: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
