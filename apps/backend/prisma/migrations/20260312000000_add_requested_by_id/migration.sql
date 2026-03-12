-- Add requestedById to transport_jobs to track who originally placed a disposal/freight request.
-- This is separate from driverId which is the assigned carrier driver.
ALTER TABLE "transport_jobs" ADD COLUMN "requested_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
