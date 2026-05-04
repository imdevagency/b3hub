-- AddColumn: GuestOrder.bisNumber
-- BIS (Būvniecības informācijas sistēma) case reference for construction waste disposal.
-- Required by Latvian law for licensed recycling facility intake records.

ALTER TABLE "GuestOrder" ADD COLUMN "bisNumber" TEXT;
