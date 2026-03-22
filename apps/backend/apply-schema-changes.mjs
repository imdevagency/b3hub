#!/usr/bin/env node
/**
 * Applies the framework contract schema changes directly via PrismaClient.
 * Runs via the pooled DATABASE_URL (which works for queries/writes).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const env = {};
const envContent = readFileSync(resolve(__dirname, '.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
}

// Apply env to process.env before requiring Prisma
Object.assign(process.env, env);

// Dynamically import PrismaClient with PrismaPg adapter (matches how the app uses it)
const { PrismaClient } = await import('@prisma/client');
const { PrismaPg } = await import('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Applying framework contract schema changes...');

  // 1. Add DRAFT to the PostgreSQL enum (IF NOT EXISTS is PostgreSQL 14+)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "FrameworkContractStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE'`
    );
    console.log('✓ DRAFT added to FrameworkContractStatus enum');
  } catch (e) {
    // Older Postgres doesn't support IF NOT EXISTS on ALTER TYPE ADD VALUE
    if (e.message.includes('already exists')) {
      console.log('✓ DRAFT enum value already existed');
    } else {
      console.error('✗ enum error:', e.message);
    }
  }

  // 2. Add supplierId column (IF NOT EXISTS avoids errors if already applied)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "framework_contracts" ADD COLUMN IF NOT EXISTS "supplierId" TEXT`
    );
    console.log('✓ supplierId column added (or already existed)');
  } catch (e) {
    console.error('✗ supplierId column error:', e.message);
  }

  // 3. Add FK constraint (catch if already exists — already ran once)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "framework_contracts" ADD CONSTRAINT "framework_contracts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    console.log('✓ FK constraint added');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('✓ FK constraint already existed');
    } else {
      console.error('✗ FK constraint error:', e.message);
    }
  }

  // 4. Update default for status column
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "framework_contracts" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"FrameworkContractStatus"`
    );
    console.log('✓ status default updated to DRAFT');
  } catch (e) {
    console.error('✗ status default error:', e.message);
  }

  console.log('\nDone!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
