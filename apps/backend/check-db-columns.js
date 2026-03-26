/**
 * check-db-columns.js
 * Checks what columns exist in the companies table.
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

async function main() {
  const url = envVars['DATABASE_URL'];
  console.log('Connecting to:', url.substring(0, 60) + '...');
  const pool = new Pool({ connectionString: url });

  const { rows } = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'companies'
     ORDER BY ordinal_position`,
  );

  console.log('\nColumns in "companies" table:');
  rows.forEach((r) => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'}`));

  // Also check if any demo users exist
  const users = await pool.query('SELECT email, "userType" FROM users LIMIT 10');
  console.log('\nExisting users:');
  users.rows.forEach((u) => console.log(`  ${u.email} (${u.userType})`));

  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
