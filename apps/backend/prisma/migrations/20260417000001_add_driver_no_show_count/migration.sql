-- Add noShowCount to driver_profiles
-- Tracks how many times a driver has self-cancelled a job.
-- Used for dispatcher dashboards and auto-deprioritisation of unreliable drivers.

ALTER TABLE "driver_profiles" ADD COLUMN "noShowCount" INTEGER NOT NULL DEFAULT 0;
