import { IsEnum, IsString, IsNumber, IsOptional, IsInt, Min, IsIn, IsObject } from 'class-validator';
import { RentalServiceType, PaymentMethod } from '@prisma/client';

export class CreateRentalOrderDto {
  @IsEnum(RentalServiceType)
  serviceType: RentalServiceType;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsInt()
  @Min(1)
  hireDays: number;

  @IsString()
  deliveryDate: string; // ISO date string

  @IsOptional()
  @IsIn(['AM', 'PM', 'ANY'])
  deliveryWindow?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Service-specific configuration (e.g. { heightMetres: 6 } for scaffolding) */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
