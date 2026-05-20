-- Remove unused VehicleType enum values: CAR, VAN, HOOK_LIFT, PICKUP_TRUCK
-- Kept: DUMP_TRUCK, FLATBED_TRUCK, SEMI_TRAILER, SKIP_LOADER, TANKER

-- Step 1: Delete vehicles that have a removed type (no construction use)
DELETE FROM "vehicles" WHERE "vehicleType"::text IN ('CAR', 'VAN', 'HOOK_LIFT', 'PICKUP_TRUCK');

-- Step 2: Null out transport job references to removed types
UPDATE "transport_jobs"
SET "requiredVehicleEnum" = NULL
WHERE "requiredVehicleEnum"::text IN ('CAR', 'VAN', 'HOOK_LIFT', 'PICKUP_TRUCK');

-- Step 3: Rename old enum, create new one, migrate columns, drop old
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";

CREATE TYPE "VehicleType" AS ENUM ('DUMP_TRUCK', 'FLATBED_TRUCK', 'SEMI_TRAILER', 'SKIP_LOADER', 'TANKER');

ALTER TABLE "vehicles"
  ALTER COLUMN "vehicleType" TYPE "VehicleType"
  USING "vehicleType"::text::"VehicleType";

ALTER TABLE "transport_jobs"
  ALTER COLUMN "requiredVehicleEnum" TYPE "VehicleType"
  USING "requiredVehicleEnum"::text::"VehicleType";

DROP TYPE "VehicleType_old";
