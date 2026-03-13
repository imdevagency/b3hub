import { IsEnum, IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { TransportJobStatus } from '@prisma/client';

const ALLOWED_DRIVER_STATUSES: TransportJobStatus[] = [
  TransportJobStatus.EN_ROUTE_PICKUP,
  TransportJobStatus.AT_PICKUP,
  TransportJobStatus.LOADED,
  TransportJobStatus.EN_ROUTE_DELIVERY,
  TransportJobStatus.AT_DELIVERY,
  TransportJobStatus.DELIVERED,
];

export class UpdateStatusDto {
  @IsEnum(TransportJobStatus, { message: 'Invalid status' })
  status: TransportJobStatus;

  /** Actual weigh-bridge reading in kg — required when status = LOADED */
  @IsOptional()
  @IsNumber()
  @Min(1)
  weightKg?: number;

  /** Weighing slip photo (base64 data URI or public URL) — optional, captured by driver at pickup */
  @IsOptional()
  @IsString()
  pickupPhotoUrl?: string;
}

export { ALLOWED_DRIVER_STATUSES };
