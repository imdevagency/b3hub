-- Migration: rental_listings_addons_insurance
-- Adds add-ons, insurance, pricing policies and VAT breakdown fields
-- to rental_listings and rental_orders tables.

-- Ensure rental_listings table exists (may have been created via db push)
CREATE TABLE IF NOT EXISTS "rental_listings" (
  "id"                     TEXT NOT NULL,
  "providerId"             TEXT NOT NULL,
  "serviceType"            "RentalServiceType" NOT NULL,
  "name"                   TEXT NOT NULL,
  "description"            TEXT,
  "unitLabel"              TEXT NOT NULL DEFAULT 'vienība',
  "pricePerDay"            DOUBLE PRECISION NOT NULL,
  "currency"               TEXT NOT NULL DEFAULT 'EUR',
  "hirePeriodOptions"      JSONB NOT NULL DEFAULT '[]',
  "quantityTotal"          INTEGER NOT NULL DEFAULT 1,
  "coverageCities"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deliveryRadiusKm"       DOUBLE PRECISION,
  "providerLat"            DOUBLE PRECISION,
  "providerLng"            DOUBLE PRECISION,
  "blockedDates"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "imageUrls"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "specs"                  JSONB,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rental_listings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rental_listings_providerId_idx" ON "rental_listings"("providerId");
CREATE INDEX IF NOT EXISTS "rental_listings_serviceType_isActive_idx" ON "rental_listings"("serviceType", "isActive");

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
