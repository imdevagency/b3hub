-- Add DELIVERY_REFUSED to TransportJobStatus enum
-- This allows drivers to mark a delivery as refused by the site/buyer at the door,
-- triggering admin intervention without losing the delivery attempt record.

ALTER TYPE "TransportJobStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_REFUSED';
