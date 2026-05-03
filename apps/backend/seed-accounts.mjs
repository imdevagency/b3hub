/**
 * seed-accounts.mjs
 * Creates one demo account for every role/capability on the platform.
 * Run from apps/backend:  node seed-accounts.mjs
 *
 * What it does:
 *   1. Registers each user via POST /api/v1/auth/register
 *   2. Marks email as verified (skips email flow)
 *   3. Patches the DB directly to grant the right capabilities / userType
 *   4. For company accounts, creates & links a Company record
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const API = `http://localhost:${process.env.PORT ?? 3000}/api/v1`;
const PASSWORD = 'Test1234!';

// Use the direct connection URL for seeding (bypasses pgBouncer)
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ─── Account definitions ───────────────────────────────────────────────────────

const ACCOUNTS = [
  {
    email: 'admin@b3hub.lv',
    firstName: 'Platform',
    lastName: 'Admin',
    role: 'admin',
    description: 'Platform admin — full /dashboard/admin access',
    registerPayload: {
      email: 'admin@b3hub.lv',
      password: PASSWORD,
      firstName: 'Platform',
      lastName: 'Admin',
      roles: ['BUYER'],
      termsAccepted: true,
    },
    patch: { userType: 'ADMIN' },
  },
  {
    email: 'buyer@b3hub.lv',
    firstName: 'Individual',
    lastName: 'Buyer',
    role: 'buyer',
    description: 'B2C buyer — individual, no company',
    registerPayload: {
      email: 'buyer@b3hub.lv',
      password: PASSWORD,
      firstName: 'Individual',
      lastName: 'Buyer',
      roles: ['BUYER'],
      termsAccepted: true,
    },
    patch: {},
  },
  {
    email: 'construction@b3hub.lv',
    firstName: 'Construction',
    lastName: 'Manager',
    role: 'buyer-company',
    description: 'B2B buyer — construction company (CONSTRUCTION)',
    registerPayload: {
      email: 'construction@b3hub.lv',
      password: PASSWORD,
      firstName: 'Construction',
      lastName: 'Manager',
      roles: ['BUYER'],
      isCompany: true,
      companyName: 'Demo Construction SIA',
      regNumber: '40001000001',
      termsAccepted: true,
    },
    patch: {},
    company: { name: 'Demo Construction SIA', companyType: 'CONSTRUCTION', registrationNum: '40001000001' },
  },
  {
    email: 'supplier@b3hub.lv',
    firstName: 'Material',
    lastName: 'Supplier',
    role: 'supplier',
    description: 'Approved seller — can list materials (canSell)',
    registerPayload: {
      email: 'supplier@b3hub.lv',
      password: PASSWORD,
      firstName: 'Material',
      lastName: 'Supplier',
      roles: ['SUPPLIER'],
      isCompany: true,
      companyName: 'Demo Quarry SIA',
      regNumber: '40002000002',
      termsAccepted: true,
    },
    patch: { canSell: true },
    company: { name: 'Demo Quarry SIA', companyType: 'SUPPLIER', registrationNum: '40002000002' },
  },
  {
    email: 'carrier@b3hub.lv',
    firstName: 'Transport',
    lastName: 'Carrier',
    role: 'carrier',
    description: 'Approved carrier company (canTransport)',
    registerPayload: {
      email: 'carrier@b3hub.lv',
      password: PASSWORD,
      firstName: 'Transport',
      lastName: 'Carrier',
      roles: ['CARRIER'],
      isCompany: true,
      companyName: 'Demo Carriers SIA',
      regNumber: '40003000003',
      termsAccepted: true,
    },
    patch: { canTransport: true },
    company: { name: 'Demo Carriers SIA', companyType: 'CARRIER', registrationNum: '40003000003' },
  },
  {
    email: 'driver@b3hub.lv',
    firstName: 'Solo',
    lastName: 'Driver',
    role: 'driver',
    description: 'Individual driver (canTransport, no company)',
    registerPayload: {
      email: 'driver@b3hub.lv',
      password: PASSWORD,
      firstName: 'Solo',
      lastName: 'Driver',
      roles: ['CARRIER'],
      termsAccepted: true,
    },
    patch: { canTransport: true },
  },
  {
    email: 'recycler@b3hub.lv',
    firstName: 'Recycling',
    lastName: 'Operator',
    role: 'recycler',
    description: 'Recycling / waste center operator (canRecycle)',
    registerPayload: {
      email: 'recycler@b3hub.lv',
      password: PASSWORD,
      firstName: 'Recycling',
      lastName: 'Operator',
      roles: ['BUYER'],
      isCompany: true,
      companyName: 'Demo Recycling SIA',
      regNumber: '40004000004',
      termsAccepted: true,
    },
    patch: { canRecycle: true },
    company: { name: 'Demo Recycling SIA', companyType: 'RECYCLER', registrationNum: '40004000004' },
  },
  {
    email: 'skiphire@b3hub.lv',
    firstName: 'Skip',
    lastName: 'Hire',
    role: 'skip-hire',
    description: 'Skip hire fleet operator (canSkipHire)',
    registerPayload: {
      email: 'skiphire@b3hub.lv',
      password: PASSWORD,
      firstName: 'Skip',
      lastName: 'Hire',
      roles: ['BUYER'],
      isCompany: true,
      companyName: 'Demo Skip Hire SIA',
      regNumber: '40005000005',
      termsAccepted: true,
    },
    patch: { canSkipHire: true },
    company: { name: 'Demo Skip Hire SIA', companyType: 'SUPPLIER', registrationNum: '40005000005' },
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function registerUser(payload) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.message ?? res.statusText;
    if (typeof msg === 'string' && msg.toLowerCase().includes('already exists')) return null; // already seeded
    throw new Error(`Register failed for ${payload.email}: ${JSON.stringify(msg)}`);
  }
  return body; // { user, token }
}

async function patchUser(email, patch, companyDef) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found in DB: ${email}`);

  // Verify email directly (skip email flow)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
      ...patch,
    },
  });

  // Create company if needed and not yet linked
  if (companyDef) {
    const existingCompany = companyDef.registrationNum
      ? await prisma.company.findUnique({ where: { registrationNum: companyDef.registrationNum } })
      : null;
    let company = existingCompany;
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: companyDef.name,
          legalName: companyDef.name,
          companyType: companyDef.companyType,
          registrationNum: companyDef.registrationNum,
          email: email,
          phone: '+37100000000',
          street: 'Demo iela 1',
          city: 'Rīga',
          state: 'Rīgas raj.',
          postalCode: 'LV-1001',
          country: 'LV',
        },
      });
    }
    // Link user to company as OWNER if not already linked
    const linked = await prisma.user.findUnique({ where: { id: user.id }, select: { companyId: true } });
    if (!linked.companyId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id, companyRole: 'OWNER', isCompany: true },
      });
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding demo accounts...\n');

  const results = [];

  for (const account of ACCOUNTS) {
    process.stdout.write(`  ${account.email.padEnd(30)} `);
    try {
      const res = await registerUser(account.registerPayload);
      const status = res === null ? 'already exists' : 'registered';
      await patchUser(account.email, account.patch, account.company ?? null);
      console.log(`✓ ${status}`);
      results.push({ ...account, status: 'ok' });
    } catch (err) {
      console.log(`✗ ${err.message}`);
      results.push({ ...account, status: 'error', error: err.message });
    }
  }

  console.log('\n─── Demo Accounts ───────────────────────────────────────────');
  console.log(`${'Email'.padEnd(32)} ${'Password'.padEnd(14)} Role / Description`);
  console.log('─'.repeat(80));
  for (const a of results) {
    const status = a.status === 'ok' ? '' : ' ✗ ERROR';
    console.log(`${a.email.padEnd(32)} ${PASSWORD.padEnd(14)} ${a.description}${status}`);
  }
  console.log('─'.repeat(80));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
