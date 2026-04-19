/**
 * apply-missing-columns.js
 * Applies missing columns to sync DB with Prisma schema.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env
const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const envVars = {};
envText.split('\n').forEach((line) => {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

async function getColumns(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function main() {
  const url = envVars['DATABASE_URL'];
  const pool = new Pool({ connectionString: url });

  console.log('Checking DB state...\n');

  const companyCols = await getColumns(pool, 'companies');
  const userCols = await getColumns(pool, 'users');
  const orderCols = await getColumns(pool, 'orders');

  const migrations = [];

  // Company table missing columns
  if (!companyCols.has('stripeConnectId')) {
    migrations.push(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeConnectId" TEXT`);
  }
  if (!companyCols.has('commissionRate')) {
    migrations.push(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0`);
  }
  if (!companyCols.has('payoutEnabled')) {
    migrations.push(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "payoutEnabled" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!companyCols.has('serviceRadiusKm')) {
    migrations.push(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "serviceRadiusKm" INTEGER`);
  }

  // User table - check for newer fields
  if (!userCols.has('refreshToken')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT`);
  }
  if (!userCols.has('permCreateContracts')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permCreateContracts" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!userCols.has('permReleaseCallOffs')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permReleaseCallOffs" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!userCols.has('permManageOrders')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permManageOrders" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!userCols.has('permViewFinancials')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permViewFinancials" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!userCols.has('permManageTeam')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permManageTeam" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!userCols.has('payoutEnabled')) {
    migrations.push(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payoutEnabled" BOOLEAN NOT NULL DEFAULT false`);
  }

  if (migrations.length === 0) {
    console.log('No missing columns found. DB is in sync.');
    await pool.end();
    return;
  }

  console.log(`Applying ${migrations.length} schema changes:\n`);
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log(`  ✅  ${sql.substring(0, 80)}...`);
    } catch (e) {
      console.error(`  ❌  ${sql.substring(0, 80)}...`);
      console.error(`      Error: ${e.message}`);
    }
  }

  console.log('\nDone!');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
