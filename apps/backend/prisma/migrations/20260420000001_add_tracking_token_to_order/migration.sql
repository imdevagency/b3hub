-- AlterTable
ALTER TABLE "orders" ADD COLUMN "trackingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_trackingToken_key" ON "orders"("trackingToken");

-- CreateIndex
CREATE INDEX "orders_trackingToken_idx" ON "orders"("trackingToken");
