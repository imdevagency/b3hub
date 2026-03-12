-- Framework Contracts: blanket agreements with contingent tracking
-- Buyers set a total quantity, then release individual transport job call-offs

CREATE TABLE "framework_contracts" (
  "id"             TEXT NOT NULL,
  "contractNumber" TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "buyerId"        TEXT NOT NULL,
  "createdById"    TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "startDate"      TIMESTAMP(3) NOT NULL,
  "endDate"        TIMESTAMP(3),
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "framework_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "framework_contracts_contractNumber_key" ON "framework_contracts"("contractNumber");

ALTER TABLE "framework_contracts"
  ADD CONSTRAINT "framework_contracts_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "framework_contracts"
  ADD CONSTRAINT "framework_contracts_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Framework Positions: line items within a contract

CREATE TABLE "framework_positions" (
  "id"              TEXT NOT NULL,
  "contractId"      TEXT NOT NULL,
  "positionType"    TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "agreedQty"       DOUBLE PRECISION NOT NULL,
  "unit"            TEXT NOT NULL DEFAULT 't',
  "unitPrice"       DOUBLE PRECISION,
  "pickupAddress"   TEXT,
  "pickupCity"      TEXT,
  "deliveryAddress" TEXT,
  "deliveryCity"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "framework_positions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "framework_positions"
  ADD CONSTRAINT "framework_positions_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "framework_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link transport_jobs to framework contracts / positions

ALTER TABLE "transport_jobs" ADD COLUMN "frameworkContractId" TEXT;
ALTER TABLE "transport_jobs" ADD COLUMN "frameworkPositionId" TEXT;

ALTER TABLE "transport_jobs"
  ADD CONSTRAINT "transport_jobs_frameworkContractId_fkey"
  FOREIGN KEY ("frameworkContractId") REFERENCES "framework_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_jobs"
  ADD CONSTRAINT "transport_jobs_frameworkPositionId_fkey"
  FOREIGN KEY ("frameworkPositionId") REFERENCES "framework_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
