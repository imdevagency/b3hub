-- Create FrameworkContractStatus enum if it doesn't already exist.
-- It may have been applied to production via db push; shadow DB rebuilds from
-- scratch so needs it created here before ALTER TYPE can reference it.
DO $$ BEGIN
  CREATE TYPE "FrameworkContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Convert status column from TEXT to FrameworkContractStatus enum.
-- On production the column is already an enum so this is a no-op.
ALTER TABLE "framework_contracts"
  ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "framework_contracts"
  ALTER COLUMN "status" TYPE "FrameworkContractStatus"
  USING "status"::"FrameworkContractStatus";

-- Add DRAFT to FrameworkContractStatus PostgreSQL enum (Prisma created this as a native enum via db push)
ALTER TYPE "FrameworkContractStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE';

-- Add supplierId to framework_contracts (nullable — not all contracts have a designated supplier)
ALTER TABLE "framework_contracts"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE "framework_contracts"
  ADD CONSTRAINT "framework_contracts_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: SET DEFAULT 'DRAFT' is intentionally deferred to the next migration.
-- PostgreSQL does not allow using a newly added enum value ('DRAFT') in the same
-- transaction where ADD VALUE ran. Prisma Client uses @default(DRAFT) from the
-- schema so application behaviour is unaffected.
