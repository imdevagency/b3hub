import { IsEnum } from 'class-validator';
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
}

export { ALLOWED_DRIVER_STATUSES };
