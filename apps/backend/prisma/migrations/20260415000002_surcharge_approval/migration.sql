-- Add surcharge approval workflow columns
ALTER TABLE "order_surcharges" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "order_surcharges" ADD COLUMN "approvedByAdminId" TEXT;
ALTER TABLE "order_surcharges" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "order_surcharges" ADD COLUMN "rejectionNote" TEXT;

-- Index for fast pending queue lookup
CREATE INDEX "order_surcharges_approvalStatus_idx" ON "order_surcharges"("approvalStatus");
