-- AlterTable
ALTER TABLE "materials" ADD COLUMN "wasteRecordId" TEXT,
ADD COLUMN "recoveryRate" DOUBLE PRECISION,
ADD COLUMN "provenanceFacility" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "materials_wasteRecordId_key" ON "materials"("wasteRecordId");
