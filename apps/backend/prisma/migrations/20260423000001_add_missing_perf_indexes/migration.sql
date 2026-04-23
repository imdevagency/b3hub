-- Add missing performance indexes for orders, transport_jobs, materials, and notifications.
-- These were defined in schema.prisma but never included in a migration file.
-- Without them, list queries on high-volume tables do full sequential scans under load.

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_buyerId_idx"
  ON "orders"("buyerId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_createdById_idx"
  ON "orders"("createdById");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_status_idx"
  ON "orders"("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_status_createdAt_idx"
  ON "orders"("status", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_projectId_idx"
  ON "orders"("projectId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_scheduleId_idx"
  ON "orders"("scheduleId");

-- ── transport_jobs ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_driverId_idx"
  ON "transport_jobs"("driverId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_carrierId_idx"
  ON "transport_jobs"("carrierId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_orderId_idx"
  ON "transport_jobs"("orderId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_projectId_idx"
  ON "transport_jobs"("projectId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_status_idx"
  ON "transport_jobs"("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "transport_jobs_status_pickupDate_idx"
  ON "transport_jobs"("status", "pickupDate");

-- ── materials ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "materials_supplierId_idx"
  ON "materials"("supplierId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "materials_active_category_idx"
  ON "materials"("active", "category");

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_userId_idx"
  ON "notifications"("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_userId_read_idx"
  ON "notifications"("userId", "read");
