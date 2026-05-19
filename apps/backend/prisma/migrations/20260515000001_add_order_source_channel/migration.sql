-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "RentalServiceType" ADD VALUE 'AIR_COMPRESSOR';
ALTER TYPE "RentalServiceType" ADD VALUE 'POWER_TOOLS';
ALTER TYPE "RentalServiceType" ADD VALUE 'WELDER';
ALTER TYPE "RentalServiceType" ADD VALUE 'HEATER';
ALTER TYPE "RentalServiceType" ADD VALUE 'CONCRETE_EQUIPMENT';
ALTER TYPE "RentalServiceType" ADD VALUE 'REBAR_EQUIPMENT';
ALTER TYPE "RentalServiceType" ADD VALUE 'ALUMINUM_TOWER';

-- DropForeignKey
ALTER TABLE "buyer_supplier_relationships" DROP CONSTRAINT "buyer_supplier_relationships_buyerCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "buyer_supplier_relationships" DROP CONSTRAINT "buyer_supplier_relationships_sellerCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_sellerCompanyId_fkey";

-- DropIndex
DROP INDEX "orders_quoteRequestId_key";

-- DropIndex
DROP INDEX "orders_sellerCompanyId_idx";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "quoteRequestId",
DROP COLUMN "sellerCompanyId",
DROP COLUMN "sourceChannel";

-- DropTable
DROP TABLE "buyer_supplier_relationships";

-- DropEnum
DROP TYPE "OrderSourceChannel";

-- DropEnum
DROP TYPE "RelationshipSource";
