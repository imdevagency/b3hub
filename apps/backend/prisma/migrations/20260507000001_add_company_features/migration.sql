-- Migration: Add CompanyFeature enum and features column to companies
-- CompanyFeature flags enable SaaS module access per company:
--   CONSTRUCTION_MANAGEMENT — project management, DPRs, budgets (B3 Construction SaaS)
--   RECYCLING_MANAGEMENT    — facility intake, APUS, waste certs (B3 Recycling SaaS)

-- Step 1: Create the enum type
CREATE TYPE "CompanyFeature" AS ENUM ('CONSTRUCTION_MANAGEMENT', 'RECYCLING_MANAGEMENT');

-- Step 2: Add the features column (array, default empty)
ALTER TABLE "companies" ADD COLUMN "features" "CompanyFeature"[] NOT NULL DEFAULT ARRAY[]::"CompanyFeature"[];
