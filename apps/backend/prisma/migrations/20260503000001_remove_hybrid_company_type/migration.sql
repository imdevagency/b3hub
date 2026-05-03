-- Migration: Remove HYBRID from CompanyType enum
-- HYBRID was a vague catch-all for companies with multiple services.
-- Multi-capability is now expressed via user capability flags (canSell, canTransport, etc.).
-- Existing HYBRID companies are migrated to SUPPLIER (their primary business identity).

-- Step 1: Migrate existing HYBRID companies to SUPPLIER
UPDATE "companies" SET "companyType" = 'SUPPLIER' WHERE "companyType" = 'HYBRID';

-- Step 2: Recreate enum without HYBRID
-- PostgreSQL does not support DROP VALUE from an enum; we must recreate it.
ALTER TYPE "CompanyType" RENAME TO "CompanyType_old";
CREATE TYPE "CompanyType" AS ENUM ('CONSTRUCTION', 'SUPPLIER', 'RECYCLER', 'CARRIER');
ALTER TABLE "companies" ALTER COLUMN "companyType" TYPE "CompanyType" USING "companyType"::text::"CompanyType";
DROP TYPE "CompanyType_old";
