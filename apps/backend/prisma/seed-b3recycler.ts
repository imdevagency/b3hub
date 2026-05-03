/**
 * Seed B3 Recycling Gulbene — licensed recycling facility.
 * Creates:
 *   1. A B3 Group company (type RECYCLER) if not already present
 *   2. An operator user with canRecycle: true
 *   3. The RecyclingCenter record for Gulbene
 *
 * Run: npx tsx prisma/seed-b3recycler.ts
 */
import 'dotenv/config';
import {
  PrismaClient,
  UserType,
  UserStatus,
  CompanyType,
  WasteType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash('Recycle123!', 10);

  // ── 1. Upsert B3 Recycling company ────────────────────────────────────────
  let company = await prisma.company.findFirst({
    where: { name: 'B3 Recycling SIA' },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'B3 Recycling SIA',
        legalName: 'B3 Recycling SIA',
        registrationNum: 'LV40003000001',
        companyType: CompanyType.RECYCLER,
        email: 'info@b3recycling.lv',
        phone: '+37120000100',
        street: 'Noliktavas iela 2',
        city: 'Gulbene',
        state: 'Gulbenes novads',
        postalCode: 'LV-4401',
        country: 'LV',
      },
    });
    console.log(`✓ Company created: ${company.name} (${company.id})`);
  } else {
    console.log(`• Company exists: ${company.name} (${company.id})`);
  }

  // ── 2. Upsert operator user ────────────────────────────────────────────────
  let operator = await prisma.user.findUnique({
    where: { email: 'recycler@b3hub.lv' },
  });

  if (!operator) {
    operator = await prisma.user.create({
      data: {
        email: 'recycler@b3hub.lv',
        firstName: 'B3',
        lastName: 'Recycler',
        password,
        userType: UserType.BUYER,
        status: UserStatus.ACTIVE,
        isCompany: true,
        canSell: false,
        canTransport: false,
        canSkipHire: false,
        canRecycle: true,
        companyId: company.id,
        companyRole: 'OWNER',
        permCreateContracts: true,
        permReleaseCallOffs: true,
        permManageOrders: true,
        permViewFinancials: true,
        permManageTeam: true,
        phoneVerified: false,
        termsAcceptedAt: new Date(),
      },
    });
    console.log(`✓ Operator created: ${operator.email} / Recycle123!`);
  } else {
    // Ensure canRecycle is enabled
    await prisma.user.update({
      where: { id: operator.id },
      data: { canRecycle: true, companyId: company.id },
    });
    console.log(`• Operator exists: ${operator.email}`);
  }

  // ── 3. Upsert RecyclingCenter ─────────────────────────────────────────────
  const existing = await prisma.recyclingCenter.findFirst({
    where: { companyId: company.id, name: 'B3 Recycling Gulbene' },
  });

  if (!existing) {
    const center = await prisma.recyclingCenter.create({
      data: {
        name: 'B3 Recycling Gulbene',
        address: 'Noliktavas iela 2',
        city: 'Gulbene',
        state: 'Gulbenes novads',
        postalCode: 'LV-4401',
        coordinates: { lat: 57.1753, lng: 26.7497 },
        companyId: company.id,
        acceptedWasteTypes: [
          WasteType.CONCRETE,
          WasteType.BRICK,
          WasteType.WOOD,
          WasteType.METAL,
          WasteType.SOIL,
          WasteType.MIXED,
        ],
        capacity: 50, // 50 tonnes per day
        certifications: ['ISO 14001', 'VVD Licence No. R-12345'],
        operatingHours: {
          monday:    { open: '07:00', close: '18:00' },
          tuesday:   { open: '07:00', close: '18:00' },
          wednesday: { open: '07:00', close: '18:00' },
          thursday:  { open: '07:00', close: '18:00' },
          friday:    { open: '07:00', close: '17:00' },
          saturday:  null,
          sunday:    null,
        },
        licensed: true,
        apusRegistrationId: 'GULBENE-R-001',
        active: true,
      },
    });
    console.log(`✓ RecyclingCenter created: ${center.name} (${center.id})`);
  } else {
    console.log(`• RecyclingCenter exists: ${existing.name} (${existing.id})`);
  }

  console.log('\n✅ B3 Recycling Gulbene seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
