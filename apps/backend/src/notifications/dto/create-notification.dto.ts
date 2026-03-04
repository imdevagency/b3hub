import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  TRANSPORT_ASSIGNED = 'TRANSPORT_ASSIGNED',
  TRANSPORT_STARTED = 'TRANSPORT_STARTED',
  TRANSPORT_COMPLETED = 'TRANSPORT_COMPLETED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  data?: Record<string, any>;
}
