#!/usr/bin/env node
// Applies pending Prisma migrations using DIRECT_URL to bypass PgBouncer

import { execSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');

// Parse .env manually
const env = {};
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = value;
}

// Use SESSION mode pooler (port 5432) from DATABASE_URL (which is transaction pooler port 6543)
// Direct connection (DIRECT_URL) is often unreachable from dev machines
const sessionUrl = (env.DATABASE_URL || '').replace(':6543/', ':5432/');
const migrationUrl = sessionUrl || env.DATABASE_URL;


console.log('Running prisma migrate deploy with direct connection...');
try {
  execSync('npx prisma migrate deploy', {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: migrationUrl },
    stdio: 'inherit',
  });
  console.log('Migration deployed successfully!');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
