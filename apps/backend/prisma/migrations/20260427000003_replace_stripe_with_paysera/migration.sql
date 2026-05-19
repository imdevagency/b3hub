-- Migration: Replace Stripe with Paysera
-- Renames Stripe-specific columns to Paysera equivalents
-- Date: 2026-04-27

-- Ensure PayoutStatus enum exists
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Ensure Payment table exists (may have been created via db push with Stripe columns)
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'EUR',
  "status"          "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "platformFee"     DOUBLE PRECISION,
  "sellerPayout"    DOUBLE PRECISION,
  "driverPayout"    DOUBLE PRECISION,
  "stripePaymentId" TEXT,
  "stripeChargeId"  TEXT,
  "transferGroup"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_key" ON "Payment"("orderId");

-- Ensure supplier_payouts table exists
CREATE TABLE IF NOT EXISTS "supplier_payouts" (
  "id"               TEXT NOT NULL,
  "orderId"          TEXT NOT NULL,
  "supplierId"       TEXT NOT NULL,
  "amount"           DOUBLE PRECISION NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'EUR',
  "status"           "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "dueDate"          TIMESTAMP(3) NOT NULL,
  "paidAt"           TIMESTAMP(3),
  "stripeTransferId" TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payouts_pkey" PRIMARY KEY ("id")
);

-- Ensure carrier_payouts table exists
CREATE TABLE IF NOT EXISTS "carrier_payouts" (
  "id"               TEXT NOT NULL,
  "orderId"          TEXT NOT NULL,
  "jobId"            TEXT,
  "driverId"         TEXT,
  "carrierId"        TEXT,
  "amount"           DOUBLE PRECISION NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'EUR',
  "status"           "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "dueDate"          TIMESTAMP(3) NOT NULL,
  "paidAt"           TIMESTAMP(3),
  "stripeTransferId" TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carrier_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "carrier_payouts_jobId_key" ON "carrier_payouts"("jobId");

-- Payment table: rename stripePaymentId → payseraOrderId (safe DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Payment' AND column_name='stripePaymentId') THEN
    ALTER TABLE "Payment" RENAME COLUMN "stripePaymentId" TO "payseraOrderId";
  ELSE
    ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payseraOrderId" TEXT;
  END IF;
END $$;

ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "stripeChargeId";

ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "transferGroup";

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "payseraPaymentUrl" TEXT;

-- SupplierPayout table: rename stripeTransferId → payseraTransferId (safe DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_payouts' AND column_name='stripeTransferId') THEN
    ALTER TABLE "supplier_payouts" RENAME COLUMN "stripeTransferId" TO "payseraTransferId";
  ELSE
    ALTER TABLE "supplier_payouts" ADD COLUMN IF NOT EXISTS "payseraTransferId" TEXT;
  END IF;
END $$;

-- CarrierPayout table: rename stripeTransferId → payseraTransferId (safe DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carrier_payouts' AND column_name='stripeTransferId') THEN
    ALTER TABLE "carrier_payouts" RENAME COLUMN "stripeTransferId" TO "payseraTransferId";
  ELSE
    ALTER TABLE "carrier_payouts" ADD COLUMN IF NOT EXISTS "payseraTransferId" TEXT;
  END IF;
END $$;

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

-- Invoice table: rename Stripe columns to Paysera (safe DO blocks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='stripePaymentLinkId') THEN
    ALTER TABLE "invoices" RENAME COLUMN "stripePaymentLinkId" TO "payseraPaymentLinkId";
  ELSE
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payseraPaymentLinkId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='stripePaymentLinkUrl') THEN
    ALTER TABLE "invoices" RENAME COLUMN "stripePaymentLinkUrl" TO "payseraPaymentLinkUrl";
  ELSE
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payseraPaymentLinkUrl" TEXT;
  END IF;
END $$;

-- SkipHireOrder table: rename stripePaymentId → payseraOrderId (safe DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skip_hire_orders' AND column_name='stripePaymentId') THEN
    ALTER TABLE "skip_hire_orders" RENAME COLUMN "stripePaymentId" TO "payseraOrderId";
  ELSE
    ALTER TABLE "skip_hire_orders" ADD COLUMN IF NOT EXISTS "payseraOrderId" TEXT;
  END IF;
END $$;

ALTER TABLE "skip_hire_orders"
  ADD COLUMN IF NOT EXISTS "payseraPaymentUrl" TEXT;

