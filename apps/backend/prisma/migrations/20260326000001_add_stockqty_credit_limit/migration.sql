-- Add stockQty field to materials table for real stock quantity tracking
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "stockQty" DOUBLE PRECISION;
