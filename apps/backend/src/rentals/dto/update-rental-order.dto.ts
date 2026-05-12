import { IsEnum, IsOptional, IsIn } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateRentalOrderDto } from './create-rental-order.dto';
import { RentalOrderStatus } from '@prisma/client';

export class UpdateRentalOrderDto extends PartialType(CreateRentalOrderDto) {}

export class UpdateRentalStatusDto {
  @IsEnum(RentalOrderStatus)
  status: RentalOrderStatus;
}
