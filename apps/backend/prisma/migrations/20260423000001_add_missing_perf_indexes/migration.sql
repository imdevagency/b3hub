-- Add missing performance indexes for orders, transport_jobs, materials, and notifications.
-- These were defined in schema.prisma but never included in a migration file.
-- Without them, list queries on high-volume tables do full sequential scans under load.

-- Add projectId and scheduleId to orders (may have been added via db push)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;

-- Add projectId to transport_jobs (may have been added via db push)
ALTER TABLE "transport_jobs" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "orders_buyerId_idx"
  ON "orders"("buyerId");

CREATE INDEX IF NOT EXISTS "orders_createdById_idx"
  ON "orders"("createdById");

CREATE INDEX IF NOT EXISTS "orders_status_idx"
  ON "orders"("status");

CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx"
  ON "orders"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_projectId_idx"
  ON "orders"("projectId");

CREATE INDEX IF NOT EXISTS "orders_scheduleId_idx"
  ON "orders"("scheduleId");

-- ── transport_jobs ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "transport_jobs_driverId_idx"
  ON "transport_jobs"("driverId");

CREATE INDEX IF NOT EXISTS "transport_jobs_carrierId_idx"
  ON "transport_jobs"("carrierId");

CREATE INDEX IF NOT EXISTS "transport_jobs_orderId_idx"
  ON "transport_jobs"("orderId");

CREATE INDEX IF NOT EXISTS "transport_jobs_projectId_idx"
  ON "transport_jobs"("projectId");

CREATE INDEX IF NOT EXISTS "transport_jobs_status_idx"
  ON "transport_jobs"("status");

CREATE INDEX IF NOT EXISTS "transport_jobs_status_pickupDate_idx"
  ON "transport_jobs"("status", "pickupDate");

-- ── materials ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "materials_supplierId_idx"
  ON "materials"("supplierId");

CREATE INDEX IF NOT EXISTS "materials_active_category_idx"
  ON "materials"("active", "category");

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "notifications_userId_idx"
  ON "notifications"("userId");

CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx"
  ON "notifications"("userId", "read");
