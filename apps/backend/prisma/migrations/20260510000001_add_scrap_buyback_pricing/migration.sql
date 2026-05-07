-- AddColumn: buybackPricePerTonne on recycling_center_pricing_rules
ALTER TABLE "recycling_center_pricing_rules" ADD COLUMN "buybackPricePerTonne" DOUBLE PRECISION;

-- AddColumn: isBuyback and buyerPayoutAmount on orders
ALTER TABLE "orders" ADD COLUMN "isBuyback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "buyerPayoutAmount" DOUBLE PRECISION;
