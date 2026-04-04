import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DisputeReason } from '@prisma/client';

export class CreateDisputeDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(DisputeReason)
  reason: DisputeReason;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;
}
