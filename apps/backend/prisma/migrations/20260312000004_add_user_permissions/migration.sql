-- AddColumn permCreateContracts
ALTER TABLE "users" ADD COLUMN "permCreateContracts" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn permReleaseCallOffs
ALTER TABLE "users" ADD COLUMN "permReleaseCallOffs" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn permManageOrders
ALTER TABLE "users" ADD COLUMN "permManageOrders" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn permViewFinancials
ALTER TABLE "users" ADD COLUMN "permViewFinancials" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn permManageTeam
ALTER TABLE "users" ADD COLUMN "permManageTeam" BOOLEAN NOT NULL DEFAULT false;
