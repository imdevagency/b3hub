-- Migration: rental_platform_foundation
-- Adds:
--   1. trackingToken + currentLocation to toilet_cabin_orders (parity with skip_hire_orders)
--   2. RentalServiceType enum
--   3. RentalOrderStatus enum
--   4. rental_orders table (generic rental service model for new services)
--   5. carrier_rental_settings table

-- 0. Ensure enums and tables that may have been created via db push exist ──────
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'INVOICE', 'SEPA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ToiletCabinType" AS ENUM ('STANDARD', 'DISABLED_ACCESS', 'VIP', 'HEATED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ToiletCabinStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED', 'IN_USE', 'COLLECTED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "toilet_cabin_orders" (
  "id"               TEXT NOT NULL,
  "orderNumber"      TEXT NOT NULL,
  "address"          TEXT NOT NULL,
  "city"             TEXT NOT NULL,
  "lat"              DOUBLE PRECISION,
  "lng"              DOUBLE PRECISION,
  "cabinType"        "ToiletCabinType" NOT NULL DEFAULT 'STANDARD',
  "cabinCount"       INTEGER NOT NULL DEFAULT 1,
  "hireDays"         INTEGER NOT NULL,
  "deliveryDate"     TIMESTAMP(3) NOT NULL,
  "deliveryWindow"   TEXT,
  "price"            DOUBLE PRECISION NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'EUR',
  "paymentMethod"    "PaymentMethod" NOT NULL DEFAULT 'CARD',
  "payseraOrderId"   TEXT,
  "payseraPaymentUrl" TEXT,
  "paymentStatus"    "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "status"           "ToiletCabinStatus" NOT NULL DEFAULT 'PENDING',
  "contactName"      TEXT,
  "contactEmail"     TEXT,
  "contactPhone"     TEXT,
  "userId"           TEXT,
  "carrierId"        TEXT,
  "notes"            TEXT,
  "statusTimestamps" JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "toilet_cabin_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "toilet_cabin_orders_orderNumber_key" ON "toilet_cabin_orders"("orderNumber");

-- 1. Toilet cabin order parity ─────────────────────────────────────────────
ALTER TABLE "toilet_cabin_orders"
  ADD COLUMN IF NOT EXISTS "currentLocation" JSONB,
  ADD COLUMN IF NOT EXISTS "trackingToken"   TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "toilet_cabin_orders_trackingToken_key"
  ON "toilet_cabin_orders"("trackingToken");

CREATE INDEX IF NOT EXISTS "toilet_cabin_orders_trackingToken_idx"
  ON "toilet_cabin_orders"("trackingToken");

-- 2. Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "RentalServiceType" AS ENUM (
    'SCAFFOLDING',
    'TEMP_FENCING',
    'SITE_OFFICE',
    'GENERATOR',
    'LIGHTING_TOWER',
    'WATER_BOWSER',
    'SKIP_HIRE',
    'TOILET_CABIN'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalOrderStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'DELIVERED',
    'IN_USE',
    'COLLECTED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. rental_orders table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "rental_orders" (
  "id"               TEXT NOT NULL,
  "orderNumber"      TEXT NOT NULL,
  "serviceType"      "RentalServiceType" NOT NULL,
  "address"          TEXT NOT NULL,
  "city"             TEXT NOT NULL,
  "lat"              DOUBLE PRECISION,
  "lng"              DOUBLE PRECISION,
  "hireDays"         INTEGER NOT NULL,
  "deliveryDate"     TIMESTAMP(3) NOT NULL,
  "deliveryWindow"   TEXT,
  "metadata"         JSONB,
  "quantity"         INTEGER NOT NULL DEFAULT 1,
  "price"            DOUBLE PRECISION NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'EUR',
  "paymentMethod"    "PaymentMethod" NOT NULL DEFAULT 'CARD',
  "payseraOrderId"   TEXT,
  "payseraPaymentUrl" TEXT,
  "paymentStatus"    "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "status"           "RentalOrderStatus" NOT NULL DEFAULT 'PENDING',
  "contactName"      TEXT,
  "contactEmail"     TEXT,
  "contactPhone"     TEXT,
  "userId"           TEXT,
  "carrierId"        TEXT,
  "currentLocation"  JSONB,
  "trackingToken"    TEXT,
  "notes"            TEXT,
  "statusTimestamps" JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rental_orders_orderNumber_key"
  ON "rental_orders"("orderNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "rental_orders_trackingToken_key"
  ON "rental_orders"("trackingToken");

CREATE INDEX IF NOT EXISTS "rental_orders_trackingToken_idx"
  ON "rental_orders"("trackingToken");

CREATE INDEX IF NOT EXISTS "rental_orders_userId_idx"
  ON "rental_orders"("userId");

CREATE INDEX IF NOT EXISTS "rental_orders_carrierId_idx"
  ON "rental_orders"("carrierId");

CREATE INDEX IF NOT EXISTS "rental_orders_serviceType_status_idx"
  ON "rental_orders"("serviceType", "status");

ALTER TABLE "rental_orders"
  ADD CONSTRAINT "rental_orders_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. carrier_rental_settings table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "carrier_rental_settings" (
  "id"               TEXT NOT NULL,
  "carrierId"        TEXT NOT NULL,
  "serviceType"      "RentalServiceType" NOT NULL,
  "pricePerUnitPerDay" DOUBLE PRECISION NOT NULL,
  "cities"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "carrier_rental_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "carrier_rental_settings_carrierId_serviceType_key"
  ON "carrier_rental_settings"("carrierId", "serviceType");

ALTER TABLE "carrier_rental_settings"
  ADD CONSTRAINT "carrier_rental_settings_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
