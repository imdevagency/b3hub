-- CreateTable (if not exists — table may have been created via db push on prod)
CREATE TABLE IF NOT EXISTS "order_schedules" (
  "id"               TEXT NOT NULL,
  "createdById"      TEXT NOT NULL,
  "orderType"        TEXT NOT NULL,
  "deliveryAddress"  TEXT NOT NULL,
  "deliveryCity"     TEXT NOT NULL,
  "deliveryState"    TEXT NOT NULL,
  "deliveryPostal"   TEXT NOT NULL,
  "deliveryWindow"   TEXT,
  "deliveryFee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "siteContactName"  TEXT,
  "siteContactPhone" TEXT,
  "projectId"        TEXT,
  "itemsSnapshot"    JSONB NOT NULL,
  "intervalDays"     INTEGER NOT NULL,
  "nextRunAt"        TIMESTAMP(3) NOT NULL,
  "endsAt"           TIMESTAMP(3),
  "enabled"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_schedules_nextRunAt_idx" ON "order_schedules"("nextRunAt");
CREATE INDEX IF NOT EXISTS "order_schedules_createdById_idx" ON "order_schedules"("createdById");

ALTER TABLE "order_schedules"
  ADD CONSTRAINT "order_schedules_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "order_schedules" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION,
                              ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION;
