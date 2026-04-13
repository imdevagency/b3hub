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
  WEIGHING_SLIP = 'WEIGHING_SLIP',
  // Semantic types added to replace generic SYSTEM_ALERT
  JOB_ALERT = 'JOB_ALERT',               // new transport job matches driver's criteria
  DRIVER_EN_ROUTE = 'DRIVER_EN_ROUTE',   // driver heading to pickup
  DRIVER_AT_DELIVERY = 'DRIVER_AT_DELIVERY', // driver arrived at delivery site
  DISPUTE_FILED = 'DISPUTE_FILED',        // buyer filed a dispute (notify admin)
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED', // admin resolved/rejected dispute (notify buyer)
  INVOICE_OVERDUE = 'INVOICE_OVERDUE',   // invoice past due date
  WEIGHT_DISCREPANCY = 'WEIGHT_DISCREPANCY', // weighbridge weight differs >5% from ordered
  INVOICE_ADJUSTED = 'INVOICE_ADJUSTED', // invoice reconciled to actual weight
  SURCHARGE_ADDED = 'SURCHARGE_ADDED',   // seller or driver added a billable surcharge
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
