-- Replace generic DUMP_TRUCK with tonnage-specific variants
-- DUMP_TRUCK_10T (up to 10t), DUMP_TRUCK_18T (standard 18t), DUMP_TRUCK_26T (articulated 26t)
-- Existing DUMP_TRUCK records migrate to DUMP_TRUCK_18T (most common class)

-- Step 1: Rename old enum
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";

-- Step 2: Create new enum with tonnage variants
CREATE TYPE "VehicleType" AS ENUM (
  'DUMP_TRUCK_10T',
  'DUMP_TRUCK_18T',
  'DUMP_TRUCK_26T',
  'FLATBED_TRUCK',
  'SEMI_TRAILER',
  'SKIP_LOADER',
  'TANKER'
);

-- Step 3: Migrate vehicles — DUMP_TRUCK → DUMP_TRUCK_18T
ALTER TABLE "vehicles"
  ALTER COLUMN "vehicleType" TYPE "VehicleType"
  USING (
    CASE "vehicleType"::text
      WHEN 'DUMP_TRUCK' THEN 'DUMP_TRUCK_18T'::"VehicleType"
      ELSE "vehicleType"::text::"VehicleType"
    END
  );

-- Step 4: Migrate transport jobs — DUMP_TRUCK → DUMP_TRUCK_18T
ALTER TABLE "transport_jobs"
  ALTER COLUMN "requiredVehicleEnum" TYPE "VehicleType"
  USING (
    CASE "requiredVehicleEnum"::text
      WHEN 'DUMP_TRUCK' THEN 'DUMP_TRUCK_18T'::"VehicleType"
      ELSE "requiredVehicleEnum"::text::"VehicleType"
    END
  );

-- Step 5: Drop old enum
DROP TYPE "VehicleType_old";
