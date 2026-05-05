/**
 * seed-b3-group.mjs
 *
 * Registers B3 Group's own entities as first-party marketplace participants.
 * Run from apps/backend:  node seed-b3-group.mjs
 *
 * Creates / upserts:
 *   1. B3 Recycling SIA  — CompanyType: HYBRID  (processes waste + sells RC materials)
 *   2. B3 Construction SIA — CompanyType: CONSTRUCTION (B2B buyer using own platform)
 *   3. B3 Loģistika SIA  — CompanyType: CARRIER  (first-party transport fleet)
 *
 * All first-party companies:
 *   - isFirstParty: true
 *   - commissionRate: 0   (owner does not pay platform fee to itself)
 *   - verified: true
 *   - payoutEnabled: true
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ─── B3 Group company definitions ─────────────────────────────────────────────

const B3_COMPANIES = [
  {
    name: 'B3 Recycling SIA',
    legalName: 'B3 Recycling SIA',
    registrationNum: '40203000001',
    companyType: 'HYBRID',
    features: ['RECYCLING_MANAGEMENT'],
    email: 'recycling@b3hub.lv',
    phone: '+37120000001',
    street: 'Gulbenes iela 1',
    city: 'Gulbene',
    state: 'Gulbenes nov.',
    postalCode: 'LV-4401',
    country: 'LV',
    description:
      'B3 Grupas pilnvarotais būvatkritumu pārstrādes uzņēmums. ' +
      'VVD licencēts objekts Gulbenē — pieņem betons, grunts, asfalt, ķieģeļi un metāls. ' +
      'Pārstrādātie materiāli tiek piedāvāti B3Hub tirgū kā RC izejvielas.',
    verified: true,
    payoutEnabled: true,
    isFirstParty: true,
    commissionRate: 0,
    carrierCommissionRate: 0,
  },
  {
    name: 'B3 Construction SIA',
    legalName: 'B3 Construction SIA',
    registrationNum: '40203000002',
    companyType: 'CONSTRUCTION',
    features: ['CONSTRUCTION_MANAGEMENT'],
    email: 'construction@b3hub.lv',
    phone: '+37120000002',
    street: 'Brīvības iela 1',
    city: 'Rīga',
    state: 'Rīgas raj.',
    postalCode: 'LV-1010',
    country: 'LV',
    description:
      'B3 Grupas zemes darbu uzņēmums. ' +
      'Izmanto B3Hub platformu materiālu pasūtījumiem, atkritumu nodošanai un pārvadājumu organizācijai saviem objektiem.',
    verified: true,
    payoutEnabled: false,
    isFirstParty: true,
    commissionRate: 0,
    carrierCommissionRate: 0,
  },
  {
    name: 'B3 Loģistika SIA',
    legalName: 'B3 Loģistika SIA',
    registrationNum: '40203000003',
    companyType: 'CARRIER',
    features: [],
    email: 'logistics@b3hub.lv',
    phone: '+37120000003',
    street: 'Krasta iela 10',
    city: 'Rīga',
    state: 'Rīgas raj.',
    postalCode: 'LV-1019',
    country: 'LV',
    description:
      'B3 Grupas pārvadājumu flote. ' +
      'Izpilda transporta darbus B3Hub platformā tāpat kā ārēji pārvadātāji — ar pilnu dispečerizāciju un maršruta dokumentāciju.',
    verified: true,
    payoutEnabled: true,
    isFirstParty: true,
    commissionRate: 0,
    carrierCommissionRate: 0,
  },
];

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🏗️  Seeding B3 Group first-party companies...\n');

  for (const def of B3_COMPANIES) {
    const { features, ...data } = def;

    const existing = await prisma.company.findFirst({
      where: { registrationNum: data.registrationNum },
      select: { id: true, name: true },
    });

    if (existing) {
      await prisma.company.update({
        where: { id: existing.id },
        data: {
          ...data,
          features: features,
        },
      });
      console.log(`✅  Updated: ${data.name} (${existing.id})`);
    } else {
      const created = await prisma.company.create({
        data: {
          ...data,
          features: features,
        },
      });
      console.log(`✅  Created: ${data.name} (${created.id})`);
    }
  }

  console.log('\n🎉  B3 Group seeding complete.');
  console.log('\nNext steps:');
  console.log('  • Assign users to these companies via the admin dashboard → Companies');
  console.log('  • For B3 Recycling: create a RecyclingCenter record linked to the HYBRID company');
  console.log('  • For B3 Loģistika: add Vehicle records and a DriverProfile for each driver');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
