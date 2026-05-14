-- Migration: rental_listings_addons_insurance
-- Adds add-ons, insurance, pricing policies and VAT breakdown fields
-- to rental_listings and rental_orders tables.

-- ── rental_listings ─────────────────────────────────────────────────────────

ALTER TABLE "rental_listings"
  ADD COLUMN IF NOT EXISTS "subCategoryLabel"       TEXT,
  ADD COLUMN IF NOT EXISTS "productCode"            TEXT,
  ADD COLUMN IF NOT EXISTS "yearOfManufacture"      INTEGER,
  ADD COLUMN IF NOT EXISTS "vatRate"                DOUBLE PRECISION NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS "minHireDays"            INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "maxHireDays"            INTEGER,
  ADD COLUMN IF NOT EXISTS "freeDeliveryRadiusKm"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "deliveryFeePerKm"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "selfCollectAvailable"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "selfCollectAddress"     TEXT,
  ADD COLUMN IF NOT EXISTS "selfCollectLat"         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "selfCollectLng"         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "documentUrls"           JSONB,
  ADD COLUMN IF NOT EXISTS "addOns"                 JSONB,
  ADD COLUMN IF NOT EXISTS "insuranceOptions"       JSONB,
  ADD COLUMN IF NOT EXISTS "insuranceRequired"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "depositAmount"          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "depositMethod"          TEXT,
  ADD COLUMN IF NOT EXISTS "fuelPolicy"             TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationPolicy"     TEXT,
  ADD COLUMN IF NOT EXISTS "lateReturnFeePerDay"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "requiredDocuments"      JSONB;

-- ── rental_orders ────────────────────────────────────────────────────────────

ALTER TABLE "rental_orders"
  ADD COLUMN IF NOT EXISTS "priceExclVat"           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vatRate"                DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vatAmount"              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "priceTotalInclVat"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "deliveryFee"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "selectedAddOns"         JSONB,
  ADD COLUMN IF NOT EXISTS "insurancePlanId"        TEXT,
  ADD COLUMN IF NOT EXISTS "insurancePlanName"      TEXT,
  ADD COLUMN IF NOT EXISTS "insurancePricePerDay"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "depositAmount"          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "depositPaid"            BOOLEAN NOT NULL DEFAULT false;
