-- Projects: construction site containers that group framework contracts
-- Each project belongs to a buyer company and can have many framework contracts

CREATE TABLE "projects" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "address"     TEXT,
  "lat"         DOUBLE PRECISION,
  "lng"         DOUBLE PRECISION,
  "notes"       TEXT,
  "buyerId"     TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "projects_buyerId_idx" ON "projects"("buyerId");

-- Add projectId to framework_contracts (nullable — existing contracts have no project)
ALTER TABLE "framework_contracts" ADD COLUMN "projectId" TEXT;

ALTER TABLE "framework_contracts"
  ADD CONSTRAINT "framework_contracts_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "framework_contracts_projectId_idx" ON "framework_contracts"("projectId");
