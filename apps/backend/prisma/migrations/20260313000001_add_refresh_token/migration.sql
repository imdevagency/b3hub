-- AlterTable: add refresh token columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenExpiry" TIMESTAMP(3);
