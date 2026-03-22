-- Add DRAFT to FrameworkContractStatus PostgreSQL enum (Prisma created this as a native enum via db push)
ALTER TYPE "FrameworkContractStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE';

-- Add supplierId to framework_contracts (nullable — not all contracts have a designated supplier)
ALTER TABLE "framework_contracts"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE "framework_contracts"
  ADD CONSTRAINT "framework_contracts_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update default to DRAFT for new contracts
ALTER TABLE "framework_contracts"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"FrameworkContractStatus";
