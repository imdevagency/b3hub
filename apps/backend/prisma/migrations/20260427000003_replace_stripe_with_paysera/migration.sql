-- Migration: Replace Stripe with Paysera
-- Renames Stripe-specific columns to Paysera equivalents
-- Date: 2026-04-27

-- Payment table
ALTER TABLE "Payment"
  RENAME COLUMN "stripePaymentId" TO "payseraOrderId";

ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "stripeChargeId";

ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "transferGroup";

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "payseraPaymentUrl" TEXT;

-- SupplierPayout table
ALTER TABLE "supplier_payouts"
  RENAME COLUMN "stripeTransferId" TO "payseraTransferId";

-- CarrierPayout table
ALTER TABLE "carrier_payouts"
  RENAME COLUMN "stripeTransferId" TO "payseraTransferId";

-- Make orderId optional on carrier_payouts (skip-hire payouts have no Order)
ALTER TABLE "carrier_payouts"
  ALTER COLUMN "orderId" DROP NOT NULL;

-- Company table
ALTER TABLE "companies"
  DROP COLUMN IF EXISTS "stripeConnectId";

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "ibanNumber" TEXT;

-- GuestOrder table
ALTER TABLE "guest_orders"
  DROP COLUMN IF EXISTS "stripePaymentIntentId";

ALTER TABLE "guest_orders"
  DROP COLUMN IF EXISTS "stripePaymentStatus";

ALTER TABLE "guest_orders"
  ADD COLUMN IF NOT EXISTS "payseraOrderId" TEXT;

ALTER TABLE "guest_orders"
  ADD COLUMN IF NOT EXISTS "payseraPaymentUrl" TEXT;

ALTER TABLE "guest_orders"
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT;

-- DriverProfile table
ALTER TABLE "driver_profiles"
  DROP COLUMN IF EXISTS "stripeConnectId";

ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "ibanNumber" TEXT;

-- Invoice table
ALTER TABLE "invoices"
  RENAME COLUMN "stripePaymentLinkId" TO "payseraPaymentLinkId";

ALTER TABLE "invoices"
  RENAME COLUMN "stripePaymentLinkUrl" TO "payseraPaymentLinkUrl";

-- SkipHireOrder table
ALTER TABLE "skip_hire_orders"
  RENAME COLUMN "stripePaymentId" TO "payseraOrderId";

ALTER TABLE "skip_hire_orders"
  ADD COLUMN IF NOT EXISTS "payseraPaymentUrl" TEXT;
