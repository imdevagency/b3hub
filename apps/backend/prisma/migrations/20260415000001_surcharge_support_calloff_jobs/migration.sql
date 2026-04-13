-- Bug fix: Allow surcharges on call-off transport jobs (no parent Order)
-- 
-- Previously OrderSurcharge.orderId was non-nullable, so drivers on call-off jobs
-- (framework contract deliveries, disposal jobs) could not record surcharges.
-- 
-- Changes:
--   1. Make order_surcharges.orderId nullable
--   2. Add transport_job_id column linking directly to transport_jobs
--   3. Add FK constraint + index on transport_job_id

-- Step 1: make orderId nullable
ALTER TABLE "order_surcharges" ALTER COLUMN "orderId" DROP NOT NULL;

-- Step 2: add transportJobId column
ALTER TABLE "order_surcharges" ADD COLUMN "transportJobId" TEXT;

-- Step 3: FK constraint
ALTER TABLE "order_surcharges"
  ADD CONSTRAINT "order_surcharges_transportJobId_fkey"
  FOREIGN KEY ("transportJobId")
  REFERENCES "transport_jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: index
CREATE INDEX "order_surcharges_transportJobId_idx" ON "order_surcharges"("transportJobId");
