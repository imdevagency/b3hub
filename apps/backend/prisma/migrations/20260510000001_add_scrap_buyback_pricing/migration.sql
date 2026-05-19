-- Ensure recycling_center_pricing_rules table exists (may have been created via db push)
CREATE TABLE IF NOT EXISTS "recycling_center_pricing_rules" (
  "id"                TEXT NOT NULL,
  "recyclingCenterId" TEXT NOT NULL,
  "wasteType"         "WasteType" NOT NULL,
  "pricePerTonne"     DOUBLE PRECISION NOT NULL,
  "minimumWeight"     DOUBLE PRECISION,
  "minimumFee"        DOUBLE PRECISION,
  "maximumWeight"     DOUBLE PRECISION,
  "accepted"          BOOLEAN NOT NULL DEFAULT true,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recycling_center_pricing_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recycling_center_pricing_rules_recyclingCenterId_wasteType_key"
  ON "recycling_center_pricing_rules"("recyclingCenterId", "wasteType");

-- AddColumn: buybackPricePerTonne on recycling_center_pricing_rules
ALTER TABLE "recycling_center_pricing_rules" ADD COLUMN IF NOT EXISTS "buybackPricePerTonne" DOUBLE PRECISION;

-- AddColumn: isBuyback and buyerPayoutAmount on orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isBuyback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyerPayoutAmount" DOUBLE PRECISION;

