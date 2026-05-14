-- Add equipment rental types to RentalServiceType enum
DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'MINI_EXCAVATOR';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'EXCAVATOR';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'DUMPER';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'COMPACTOR';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'TELEHANDLER';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'AERIAL_PLATFORM';
EXCEPTION WHEN others THEN null;
END $$;
