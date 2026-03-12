-- Apply pending requestedById migration first (idempotent)
ALTER TABLE "transport_jobs" ADD COLUMN IF NOT EXISTS "requested_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add password reset token fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
