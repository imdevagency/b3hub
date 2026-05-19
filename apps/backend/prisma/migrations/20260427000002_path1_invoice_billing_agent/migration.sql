-- Path 1: marketplace billing agent model
-- Adds per-supplier invoice issuer, commission invoices, billing agent agreement, guest payment

-- Ensure GuestOrderStatus enum exists
DO $$ BEGIN
  CREATE TYPE "GuestOrderStatus" AS ENUM ('PENDING', 'QUOTED', 'PAYMENT_SENT', 'PAID', 'ASSIGNED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Ensure guest_orders table exists (may have been created via db push)
CREATE TABLE IF NOT EXISTS "guest_orders" (
  "id"              TEXT NOT NULL,
  "orderNumber"     TEXT NOT NULL,
  "token"           TEXT NOT NULL,
  "category"        TEXT NOT NULL DEFAULT 'MATERIAL',
  "materialCategory" TEXT,
  "materialName"    TEXT,
  "quantity"        DOUBLE PRECISION,
  "unit"            TEXT,
  "deliveryAddress" TEXT NOT NULL,
  "deliveryCity"    TEXT NOT NULL,
  "deliveryPostal"  TEXT,
  "deliveryLat"     DOUBLE PRECISION,
  "deliveryLng"     DOUBLE PRECISION,
  "deliveryDate"    TIMESTAMP(3),
  "deliveryWindow"  TEXT,
  "contactName"     TEXT NOT NULL,
  "contactPhone"    TEXT NOT NULL,
  "contactEmail"    TEXT,
  "notes"           TEXT,
  "status"          "GuestOrderStatus" NOT NULL DEFAULT 'PENDING',
  "convertedOrderId" TEXT,
  "quotedAmount"    DOUBLE PRECISION,
  "quotedCurrency"  TEXT NOT NULL DEFAULT 'EUR',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_orders_orderNumber_key" ON "guest_orders"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "guest_orders_token_key" ON "guest_orders"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "guest_orders_convertedOrderId_key" ON "guest_orders"("convertedOrderId");
CREATE INDEX IF NOT EXISTS "guest_orders_token_idx" ON "guest_orders"("token");
CREATE INDEX IF NOT EXISTS "guest_orders_status_idx" ON "guest_orders"("status");
CREATE INDEX IF NOT EXISTS "guest_orders_contactPhone_idx" ON "guest_orders"("contactPhone");

-- Invoice: seller company (billing-agent-issued invoices)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sellerCompanyId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "isCommissionInvoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "commissionForInvoiceId" TEXT;

-- Company: billing agent agreement timestamp
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billingAgentAgreedAt" TIMESTAMP(3);

-- GuestOrder: Stripe payment + quoted price
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "stripePaymentStatus" TEXT;
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "quotedAmount" DOUBLE PRECISION;
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "quotedCurrency" TEXT NOT NULL DEFAULT 'EUR';

-- Indices
CREATE INDEX IF NOT EXISTS "invoices_sellerCompanyId_idx" ON "invoices"("sellerCompanyId");
CREATE INDEX IF NOT EXISTS "invoices_isCommissionInvoice_idx" ON "invoices"("isCommissionInvoice");

-- FK: invoices.sellerCompanyId → companies.id
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sellerCompanyId_fkey"
  FOREIGN KEY ("sellerCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
