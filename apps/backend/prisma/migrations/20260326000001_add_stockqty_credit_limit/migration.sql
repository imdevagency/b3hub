-- Add stockQty field to materials table for real stock quantity tracking
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "stockQty" DOUBLE PRECISION;

-- Set DB-level default for framework_contracts.status to DRAFT.
-- Deferred from migration 20260321000001 because PostgreSQL cannot use a newly
-- added enum value in the same transaction where ADD VALUE ran.
ALTER TABLE "framework_contracts"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"FrameworkContractStatus";
