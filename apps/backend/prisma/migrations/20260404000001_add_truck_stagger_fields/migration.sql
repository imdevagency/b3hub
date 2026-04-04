-- AlterTable: add multi-truck staggered delivery fields to orders
ALTER TABLE "orders"
  ADD COLUMN "truckCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "truckIntervalMinutes" INTEGER;

-- AlterTable: add truck sequence index to transport_jobs
ALTER TABLE "transport_jobs"
  ADD COLUMN "truckIndex" INTEGER;
