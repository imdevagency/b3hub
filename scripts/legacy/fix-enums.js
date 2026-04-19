/**
 * fix-enums.js
 * Adds missing enum values to the DB to match the Prisma schema.
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

async function getEnumValues(pool, enumName) {
  const { rows } = await pool.query(
    `SELECT enumlabel FROM pg_enum
     JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
     WHERE pg_type.typname = $1
     ORDER BY enumsortorder`,
    [enumName],
  );
  return rows.map((r) => r.enumlabel);
}

async function addEnumValue(pool, enumName, value) {
  try {
    await pool.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`  ✅  Added ${enumName}.${value}`);
  } catch (e) {
    console.log(`  ⚠️   ${enumName}.${value}: ${e.message}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: envVars['DATABASE_URL'] });

  // PaymentStatus
  const paymentStatuses = await getEnumValues(pool, 'PaymentStatus');
  console.log('PaymentStatus values:', paymentStatuses);

  const requiredPaymentStatuses = ['PENDING', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'PAY', 'PAID', 'PARTIALLY_PAID', 'REFUNDED', 'FAILED'];
  for (const v of requiredPaymentStatuses) {
    if (!paymentStatuses.includes(v)) {
      await addEnumValue(pool, 'PaymentStatus', v);
    }
  }

  // Check other relevant enums
  const orderStatuses = await getEnumValues(pool, 'OrderStatus');
  console.log('\nOrderStatus values:', orderStatuses);

  const skipStatuses = await getEnumValues(pool, 'SkipHireStatus');
  console.log('SkipHireStatus values:', skipStatuses);

  const quoteRequestStatuses = await getEnumValues(pool, 'QuoteRequestStatus');
  console.log('QuoteRequestStatus values:', quoteRequestStatuses);

  const quoteResponseStatuses = await getEnumValues(pool, 'QuoteResponseStatus');
  console.log('QuoteResponseStatus values:', quoteResponseStatuses);

  const frameworkStatuses = await getEnumValues(pool, 'FrameworkContractStatus');
  console.log('FrameworkContractStatus values:', frameworkStatuses);

  const transportStatuses = await getEnumValues(pool, 'TransportJobStatus');
  console.log('TransportJobStatus values:', transportStatuses);

  // Add any required enum values for FrameworkPositionType
  try {
    const fpType = await getEnumValues(pool, 'FrameworkPositionType');
    console.log('FrameworkPositionType values:', fpType);
    const requiredFP = ['MATERIAL_DELIVERY', 'SKIP_HIRE', 'WASTE_DISPOSAL', 'TRANSPORT'];
    for (const v of requiredFP) {
      if (!fpType.includes(v)) {
        await addEnumValue(pool, 'FrameworkPositionType', v);
      }
    }
  } catch (e) {
    console.log('FrameworkPositionType not found:', e.message);
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
