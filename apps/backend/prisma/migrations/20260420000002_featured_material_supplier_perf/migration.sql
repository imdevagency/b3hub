-- Add featured flag to materials for promoted catalog listings
ALTER TABLE "materials" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "materials_active_featured_idx" ON "materials"("active", "featured");

-- Add cached performance stats to companies (refreshed nightly)
ALTER TABLE "companies" ADD COLUMN "onTimePct" DOUBLE PRECISION;
ALTER TABLE "companies" ADD COLUMN "fulfillmentPct" DOUBLE PRECISION;
