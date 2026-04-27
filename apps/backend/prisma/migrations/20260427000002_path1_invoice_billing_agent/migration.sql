-- Path 1: marketplace billing agent model
-- Adds per-supplier invoice issuer, commission invoices, billing agent agreement, guest payment

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
