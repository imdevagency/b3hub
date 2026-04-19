/**
 * fix-all-tables.js
 * Comprehensive check and fix of all table/column drift between Prisma schema and DB.
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

async function tableExists(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [tableName],
  );
  return rows.length > 0;
}

async function run(pool, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✅  ${sql.substring(0, 100)}`);
  } catch (e) {
    console.log(`  ⚠️   SKIP: ${e.message.split('\n')[0]}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: envVars['DATABASE_URL'] });
  console.log('Fixing all table/column drift...\n');

  // ── skip_hire_orders ─────────────────────────────────────────────────────
  if (await tableExists(pool, 'skip_hire_orders')) {
    const cols = await getColumns(pool, 'skip_hire_orders');
    console.log('skip_hire_orders columns:', [...cols].join(', '));

    const fixes = [
      [`"lat" DOUBLE PRECISION`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION`],
      [`"lng" DOUBLE PRECISION`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION`],
      [`"contactName" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "contactName" TEXT`],
      [`"contactEmail" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "contactEmail" TEXT`],
      [`"contactPhone" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "contactPhone" TEXT`],
      [`"carrierId" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "carrierId" TEXT`],
      [`"userId" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "userId" TEXT`],
      [`"notes" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "notes" TEXT`],
      [`"unloadingPhotoUrl" TEXT`, `ALTER TABLE skip_hire_orders ADD COLUMN IF NOT EXISTS "unloadingPhotoUrl" TEXT`],
    ];

    for (const [col, sql] of fixes) {
      const colName = col.split('"')[1];
      if (!cols.has(colName)) await run(pool, sql);
    }
  } else {
    console.log('skip_hire_orders table not found');
  }

  // ── orders ───────────────────────────────────────────────────────────────
  if (await tableExists(pool, 'orders')) {
    const cols = await getColumns(pool, 'orders');
    const missing = [
      ['stripePaymentIntentId', `ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT`],
      ['stripeChargeId', `ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT`],
    ];
    for (const [col, sql] of missing) {
      if (!cols.has(col)) await run(pool, sql);
    }
  }

  // ── transport_jobs ───────────────────────────────────────────────────────
  if (await tableExists(pool, 'transport_jobs')) {
    const cols = await getColumns(pool, 'transport_jobs');
    console.log('\ntransport_jobs columns count:', cols.size);
    const missing = [
      ['callOffContractId', `ALTER TABLE transport_jobs ADD COLUMN IF NOT EXISTS "callOffContractId" TEXT`],
      ['callOffPositionId', `ALTER TABLE transport_jobs ADD COLUMN IF NOT EXISTS "callOffPositionId" TEXT`],
      ['pickupPhotoUrl', `ALTER TABLE transport_jobs ADD COLUMN IF NOT EXISTS "pickupPhotoUrl" TEXT`],
    ];
    for (const [col, sql] of missing) {
      if (!cols.has(col)) await run(pool, sql);
    }
  }

  // ── invoices ─────────────────────────────────────────────────────────────
  if (await tableExists(pool, 'invoices')) {
    const cols = await getColumns(pool, 'invoices');
    console.log('\ninvoices columns:', [...cols].join(', '));
  }

  // ── quote_requests ───────────────────────────────────────────────────────
  if (await tableExists(pool, 'quote_requests')) {
    const cols = await getColumns(pool, 'quote_requests');
    console.log('\nquote_requests columns:', [...cols].join(', '));
  }

  // ── quote_responses ──────────────────────────────────────────────────────
  if (await tableExists(pool, 'quote_responses')) {
    const cols = await getColumns(pool, 'quote_responses');
    console.log('\nquote_responses columns:', [...cols].join(', '));
  }

  // ── framework_contracts ──────────────────────────────────────────────────
  if (await tableExists(pool, 'framework_contracts')) {
    const cols = await getColumns(pool, 'framework_contracts');
    console.log('\nframework_contracts columns:', [...cols].join(', '));
  }

  // ── framework_positions ──────────────────────────────────────────────────
  if (await tableExists(pool, 'framework_positions')) {
    const cols = await getColumns(pool, 'framework_positions');
    console.log('framework_positions columns:', [...cols].join(', '));
  }

  // ── notifications ────────────────────────────────────────────────────────
  if (await tableExists(pool, 'notifications')) {
    const cols = await getColumns(pool, 'notifications');
    console.log('\nnotifications columns:', [...cols].join(', '));
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch((e) => { console.error(e); process.exit(1); });
