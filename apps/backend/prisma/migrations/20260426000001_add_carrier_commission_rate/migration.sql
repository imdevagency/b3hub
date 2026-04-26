-- Add explicit carrier commission rate to Company
-- Previously only `commissionRate` existed (defaulting to 10%, used for suppliers).
-- This migration:
--   1. Adds `carrierCommissionRate` for transport fee commission (default 8%).
--   2. Corrects `commissionRate` default from 10% → 6% for new suppliers.

ALTER TABLE "companies"
  ADD COLUMN "carrierCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 8.0;

ALTER TABLE "companies"
  ALTER COLUMN "commissionRate" SET DEFAULT 6.0;
