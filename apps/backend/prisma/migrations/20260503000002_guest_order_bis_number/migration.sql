-- AddColumn: GuestOrder.bisNumber
-- BIS (Būvniecības informācijas sistēma) case reference for construction waste disposal.
-- Required by Latvian law for licensed recycling facility intake records.

ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "bisNumber" TEXT;
