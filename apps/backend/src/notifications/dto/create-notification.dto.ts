import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  TRANSPORT_ASSIGNED = 'TRANSPORT_ASSIGNED',
  TRANSPORT_STARTED = 'TRANSPORT_STARTED',
  TRANSPORT_COMPLETED = 'TRANSPORT_COMPLETED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  QUOTE_RECEIVED = 'QUOTE_RECEIVED',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  DOCUMENT_EXPIRING_SOON = 'DOCUMENT_EXPIRING_SOON',
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
