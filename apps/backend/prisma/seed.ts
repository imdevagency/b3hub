import 'dotenv/config';
import {
  PrismaClient,
  UserType,
  UserStatus,
  MaterialCategory,
  MaterialUnit,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash('Demo1234!', 10);

  // ── Demo accounts ──────────────────────────────────────────────────────────
  const accounts = [
    // 🌟 Demo account — all roles enabled (buyer + sell + transport + admin)
    {
      email: 'demo@demo.com',
      firstName: 'Demo',
      lastName: 'User',
      phone: '+371 20 000 001',
      userType: UserType.BUYER,
      isCompany: true,
      canSell: true,
      canTransport: true,
      canSkipHire: true,
    },
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
      canSkipHire: true,
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
        canSkipHire: (account as any).canSkipHire ?? false,
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
    const caps =
      [user.canSell ? '📦 sell' : '', user.canTransport ? '🚛 transport' : '']
        .filter(Boolean)
        .join('  ') || '🛒 buyer only';

    console.log(`✅  ${account.email.padEnd(24)} │ ${caps}`);
  }

  console.log('\n🔑 Password for all accounts: Demo1234!\n');

  // ── DriverProfiles for canTransport accounts ───────────────────────────────
  const transportEmails = [
    'driver@demo.com',
    'demo@demo.com',
    'baltbuve@demo.com',
  ];
  for (const email of transportEmails) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) continue;
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);
    await prisma.driverProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        licenseNumber: `DRV-${u.id.slice(-8).toUpperCase()}`,
        licenseType: ['B', 'C', 'CE'],
        licenseExpiry: expiry,
        certifications: [],
        isOnline: false,
        available: true,
      },
    });
    console.log(`✅  DriverProfile created for ${email}`);
  }

  // ── Demo supplier company ──────────────────────────────────────────────────
  const sellerUser = await prisma.user.findUnique({
    where: { email: 'seller@demo.com' },
  });

  const demoCompany = await prisma.company.upsert({
    where: { registrationNum: 'LV40003123456' },
    update: {},
    create: {
      name: 'BaltSmiltis SIA',
      legalName: 'BaltSmiltis SIA',
      companyType: 'SUPPLIER',
      email: 'info@baltsmiltis.lv',
      phone: '+371 67 123 456',
      registrationNum: 'LV40003123456',
      taxId: 'LV40003123456',
      street: 'Smilšu iela 12',
      city: 'Rīga',
      state: 'Rīga',
      postalCode: 'LV-1001',
      country: 'LV',
    },
  });

  // Link seller user to company if not already linked
  if (sellerUser && !sellerUser.companyId) {
    await prisma.user.update({
      where: { email: 'seller@demo.com' },
      data: { companyId: demoCompany.id },
    });
  }

  console.log(`✅  Company: ${demoCompany.name} (id: ${demoCompany.id})`);

  // ── Demo buyer company (so buyer@demo.com can place orders) ───────────────
  const buyerUser = await prisma.user.findUnique({
    where: { email: 'buyer@demo.com' },
  });

  const buyerCompany = await prisma.company.upsert({
    where: { registrationNum: 'LV40001234567' },
    update: {},
    create: {
      name: 'RīgasBūve SIA',
      legalName: 'RīgasBūve SIA',
      companyType: 'CONSTRUCTION',
      email: 'info@rigasbuve.lv',
      phone: '+371 67 654 321',
      registrationNum: 'LV40001234567',
      taxId: 'LV40001234567',
      street: 'Brīvības iela 55',
      city: 'Rīga',
      state: 'Rīga',
      postalCode: 'LV-1010',
      country: 'LV',
    },
  });

  if (buyerUser && !buyerUser.companyId) {
    await prisma.user.update({
      where: { email: 'buyer@demo.com' },
      data: { companyId: buyerCompany.id },
    });
  }

  console.log(`✅  Company: ${buyerCompany.name} (id: ${buyerCompany.id})`);

  // ── Full-service demo company (demo@demo.com + baltbuve@demo.com) ──────────
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@demo.com' },
  });
  const baltbuveUser = await prisma.user.findUnique({
    where: { email: 'baltbuve@demo.com' },
  });

  const baltbuveCompany = await prisma.company.upsert({
    where: { registrationNum: 'LV40009999999' },
    update: {},
    create: {
      name: 'BaltBūve SIA',
      legalName: 'BaltBūve SIA',
      companyType: 'HYBRID',
      email: 'info@baltbuve.lv',
      phone: '+371 67 999 000',
      registrationNum: 'LV40009999999',
      taxId: 'LV40009999999',
      street: 'Brīvības iela 1',
      city: 'Rīga',
      state: 'Rīga',
      postalCode: 'LV-1001',
      country: 'LV',
      verified: true,
    },
  });

  if (demoUser && !demoUser.companyId) {
    await prisma.user.update({
      where: { email: 'demo@demo.com' },
      data: { companyId: baltbuveCompany.id },
    });
  }
  if (baltbuveUser && !baltbuveUser.companyId) {
    await prisma.user.update({
      where: { email: 'baltbuve@demo.com' },
      data: { companyId: baltbuveCompany.id },
    });
  }

  console.log(
    `✅  Company: ${baltbuveCompany.name} (id: ${baltbuveCompany.id})`,
  );

  // ── Demo materials ─────────────────────────────────────────────────────────
  const materials = [
    {
      name: 'Smiltis (Frakcija 0-4 mm)',
      description:
        'Tīra kvarca smiltis celtniecībai un apzaļumošanai. Mitruma saturs < 5%.',
      category: MaterialCategory.SAND,
      subCategory: 'Kvarca smiltis',
      basePrice: 9.5,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 5,
      maxOrder: 500,
      isRecycled: false,
      quality: 'A',
    },
    {
      name: 'Šķembas (Frakcija 8-16 mm)',
      description:
        'Granīta šķembas ceļu seguma pamatnei un betona maisījumiem.',
      category: MaterialCategory.GRAVEL,
      subCategory: 'Granīta šķembas',
      basePrice: 12.0,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 10,
      maxOrder: 1000,
      isRecycled: false,
      quality: 'A',
    },
    {
      name: 'Grants (Frakcija 0-32 mm)',
      description: 'Dabīgā grants ceļu pamatnēm, pagalmiem un drenāžai.',
      category: MaterialCategory.GRAVEL,
      subCategory: 'Dabīgā grants',
      basePrice: 7.8,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 5,
      maxOrder: 2000,
      isRecycled: false,
      quality: 'B',
    },
    {
      name: 'Dolomīts (Frakcija 16-32 mm)',
      description:
        'Dolomīta šķembas — lieliski piemērotas ceļu pamatnei un pagalmu segumiem.',
      category: MaterialCategory.STONE,
      subCategory: 'Dolomīts',
      basePrice: 14.5,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 5,
      maxOrder: 800,
      isRecycled: false,
      quality: 'A',
    },
    {
      name: 'Melnzeme (Dārza augsne)',
      description:
        'Auglīga dārza augsne ar humusa piedevu. Piemērota apzaļumošanai.',
      category: MaterialCategory.SOIL,
      subCategory: 'Dārza augsne',
      basePrice: 18.0,
      unit: MaterialUnit.M3,
      inStock: true,
      minOrder: 2,
      maxOrder: 200,
      isRecycled: false,
      quality: 'A',
    },
    {
      name: 'Oļi (Frakcija 32-64 mm)',
      description: 'Upes oļi dekoratīviem segumiem un drenāžas slāņiem.',
      category: MaterialCategory.GRAVEL,
      subCategory: 'Upes oļi',
      basePrice: 22.0,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 2,
      maxOrder: 300,
      isRecycled: false,
      quality: 'A',
    },
    {
      name: 'Reciklēts betons (Frakcija 0-40 mm)',
      description:
        'Reciklēts betona materiāls ceļu un pamatņu izbūvei. Nav piemērots ekspozīcijas slānim.',
      category: MaterialCategory.RECYCLED_CONCRETE,
      subCategory: 'RC šķembas',
      basePrice: 6.0,
      unit: MaterialUnit.TONNE,
      inStock: true,
      minOrder: 10,
      maxOrder: 5000,
      isRecycled: true,
      quality: 'B',
    },
    {
      name: 'Asfalta granulāts (RAP)',
      description:
        'Reciklēts asfalta granulāts jauna asfalta ražošanai vai ceļu pamatnei.',
      category: MaterialCategory.ASPHALT,
      subCategory: 'RAP granulāts',
      basePrice: 8.5,
      unit: MaterialUnit.TONNE,
      inStock: false,
      minOrder: 20,
      maxOrder: 3000,
      isRecycled: true,
      quality: 'B',
    },
  ];

  for (const mat of materials) {
    const existing = await prisma.material.findFirst({
      where: { name: mat.name, supplierId: demoCompany.id },
    });
    if (!existing) {
      await prisma.material.create({
        data: {
          ...mat,
          supplierId: demoCompany.id,
          currency: 'EUR',
          certificates: [],
          images: [],
        },
      });
      console.log(`  📦  ${mat.name}`);
    }
  }

  console.log('\n✅  Materials seeded\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
