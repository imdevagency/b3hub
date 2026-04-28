/**
 * Seed initial B3 Field locations.
 * Run: npx tsx prisma/seed-b3fields.ts
 */
import 'dotenv/config';
import { PrismaClient, B3FieldService } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const fields = [
    {
      name: 'B3 Field Gulbene',
      slug: 'gulbene',
      address: 'Noliktavas iela 2',
      city: 'Gulbene',
      postalCode: 'LV-4401',
      lat: 57.1753,
      lng: 26.7497,
      services: ['MATERIAL_PICKUP', 'WASTE_DISPOSAL'] as B3FieldService[],
      openingHours: {
        monday:    { open: '07:00', close: '18:00' },
        tuesday:   { open: '07:00', close: '18:00' },
        wednesday: { open: '07:00', close: '18:00' },
        thursday:  { open: '07:00', close: '18:00' },
        friday:    { open: '07:00', close: '17:00' },
        saturday:  null,
        sunday:    null,
      },
      active: true,
    },
  ];

  for (const field of fields) {
    const result = await prisma.b3Field.upsert({
      where: { slug: field.slug },
      update: {},
      create: field,
    });
    console.log(`✓ ${result.name} (${result.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
