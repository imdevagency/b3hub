import 'dotenv/config';
import { PrismaClient, UserType, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash('Demo1234!', 10);

  // ── Demo accounts ──────────────────────────────────────────────────────────
  const accounts = [
    // 🛒 Pure buyer — construction company, orders materials & skips
    {
      email: 'buyer@demo.com',
      firstName: 'Jānis',
      lastName: 'Bērziņš',
      phone: '+371 20 111 001',
      userType: UserType.BUYER,
      isCompany: true,
      canSell: false,
      canTransport: false,
    },
    // 📦 Seller only — material quarry, lists & sells aggregates
    {
      email: 'seller@demo.com',
      firstName: 'Anna',
      lastName: 'Kalniņa',
      phone: '+371 20 111 002',
      userType: UserType.BUYER,
      isCompany: true,
      canSell: true,
      canTransport: false,
    },
    // 🚛 Driver only — transport company, accepts & delivers jobs
    {
      email: 'driver@demo.com',
      firstName: 'Pēteris',
      lastName: 'Ozoliņš',
      phone: '+371 20 111 003',
      userType: UserType.BUYER,
      isCompany: false,
      canSell: false,
      canTransport: true,
    },
    // 🏢 FULL-SERVICE — BaltBūve SIA does everything:
    //    buys materials, sells from own quarry, runs own fleet
    //    → sees all 3 modes with pill switcher
    {
      email: 'baltbuve@demo.com',
      firstName: 'Mārtiņš',
      lastName: 'Ozols',
      phone: '+371 20 111 004',
      userType: UserType.BUYER,
      isCompany: true,
      canSell: true,
      canTransport: true,
    },
    // 🔑 Admin — B3Hub platform staff
    {
      email: 'admin@b3hub.com',
      firstName: 'B3Hub',
      lastName: 'Admin',
      phone: '+371 20 000 000',
      userType: UserType.ADMIN,
      isCompany: false,
      canSell: false,
      canTransport: false,
    },
  ];

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        canSell: account.canSell,
        canTransport: account.canTransport,
        isCompany: account.isCompany,
        status: UserStatus.ACTIVE,
        phone: account.phone,
      },
      create: {
        ...account,
        password,
        status: UserStatus.ACTIVE,
      },
    });
    const caps = [
      user.canSell ? '📦 sell' : '',
      user.canTransport ? '🚛 transport' : '',
    ]
      .filter(Boolean)
      .join('  ') || '🛒 buyer only';

    console.log(`✅  ${account.email.padEnd(24)} │ ${caps}`);
  }

  console.log('\n🔑 Password for all accounts: Demo1234!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
