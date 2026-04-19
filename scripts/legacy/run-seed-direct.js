/**
 * run-seed-direct.js
 * Runs a seed file using the DIRECT_URL (bypasses PgBouncer).
 * Usage: node run-seed-direct.js [seed-file.ts]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envFile = path.join(__dirname, '.env');
const envText = fs.readFileSync(envFile, 'utf8');
const envVars = {};
envText.split('\n').forEach((line) => {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) {
    envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
});

const directUrl = envVars['DIRECT_URL'];
if (!directUrl) {
  console.error('DIRECT_URL not found in .env');
  process.exit(1);
}

const seedFile = process.argv[2] || 'prisma/seed.ts';
console.log(`Running: ${seedFile} (using DIRECT_URL for DB)`);

const child = spawn(
  'npx',
  ['ts-node', '--project', 'tsconfig.json', '--transpile-only', seedFile],
  {
    env: {
      ...process.env,
      ...envVars,
      DATABASE_URL: directUrl,
    },
    stdio: 'inherit',
    cwd: __dirname,
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
