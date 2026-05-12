-- AddColumn currentLocation and trackingToken to skip_hire_orders for live driver tracking

ALTER TABLE "skip_hire_orders" ADD COLUMN "currentLocation" JSONB;
ALTER TABLE "skip_hire_orders" ADD COLUMN "trackingToken" TEXT;

-- CreateIndex for fast token lookup
CREATE UNIQUE INDEX "skip_hire_orders_trackingToken_key" ON "skip_hire_orders"("trackingToken");
CREATE INDEX "skip_hire_orders_trackingToken_idx" ON "skip_hire_orders"("trackingToken");
