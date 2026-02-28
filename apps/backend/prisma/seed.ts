import 'dotenv/config';
import { PrismaClient, UserType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Demo1234!', 10);

  const accounts = [
    {
      email: 'buyer@demo.com',
      firstName: 'Jānis',
      lastName: 'Bērziņš',
      userType: UserType.BUYER,
    },
    {
      email: 'supplier@demo.com',
      firstName: 'Anna',
      lastName: 'Kalniņa',
      userType: UserType.SUPPLIER,
    },
    {
      email: 'carrier@demo.com',
      firstName: 'Pēteris',
      lastName: 'Ozoliņš',
      userType: UserType.CARRIER,
    },
    {
      email: 'recycler@demo.com',
      firstName: 'Marta',
      lastName: 'Liepiņa',
      userType: UserType.RECYCLER,
    },
  ];

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        ...account,
        password,
        status: UserStatus.ACTIVE,
        phone: '+371 20 000 000',
      },
    });
    console.log(`✅  ${user.userType.padEnd(10)} → ${user.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
