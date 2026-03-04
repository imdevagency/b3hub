/**
 * seed-demo-jobs.ts
 *
 * Seeds a minimal set of transport jobs so the map + Avoid Empty Runs
 * feature can be tested in the mobile app.
 *
 * Run once:
 *   cd apps/backend
 *   npx ts-node --project tsconfig.json -e "require('./prisma/seed-demo-jobs.ts')"
 *
 * Or via the npm script added to package.json:
 *   npm run seed:jobs
 */
import 'dotenv/config';
import {
  PrismaClient,
  TransportJobType,
  TransportJobStatus,
  VehicleType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Latvian city coords ────────────────────────────────────────────────────────
const JURMALA  = { lat: 56.9677, lng: 23.7718 };
const RIGA     = { lat: 56.9496, lng: 24.1052 };
const OGRE     = { lat: 56.8153, lng: 24.6037 };
const SIGULDA  = { lat: 57.1534, lng: 24.8600 };
const JELGAVA  = { lat: 56.6490, lng: 23.7124 };

async function main() {
  // ── Find driver@demo.com ───────────────────────────────────────────────────
  const driver = await prisma.user.findUnique({ where: { email: 'driver@demo.com' } });
  if (!driver) {
    console.error('❌  driver@demo.com not found — run the main seed first: npm run seed');
    process.exit(1);
  }

  // ── Clean up any jobs we created before (idempotent re-runs) ─────────────
  await prisma.transportJob.deleteMany({
    where: { jobNumber: { in: ['DEMO-001', 'DEMO-002', 'DEMO-003'] } },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // ── DEMO-001: ACTIVE job assigned to driver@demo.com ─────────────────────
  //    Jūrmala (quarry) → Rīga (construction site)
  //    Status = ACCEPTED — driver has accepted, map shows current → pickup → delivery
  const active = await prisma.transportJob.create({
    data: {
      jobNumber: 'DEMO-001',
      jobType: TransportJobType.MATERIAL_DELIVERY,
      cargoType: 'Recycling Sand 0-45',
      cargoWeight: 15,
      cargoVolume: 10,

      pickupAddress: 'Jūras iela 12',
      pickupCity: 'Jūrmala',
      pickupState: 'Rīgas reģions',
      pickupPostal: 'LV-2015',
      pickupDate: tomorrow,
      pickupWindow: '08:00–10:00',
      pickupLat: JURMALA.lat,
      pickupLng: JURMALA.lng,

      deliveryAddress: 'Brīvības gatve 214',
      deliveryCity: 'Rīga',
      deliveryState: 'Rīga',
      deliveryPostal: 'LV-1039',
      deliveryDate: tomorrow,
      deliveryWindow: '10:30–13:00',
      deliveryLat: RIGA.lat,
      deliveryLng: RIGA.lng,

      distanceKm: 32,
      requiredVehicleType: 'Dump Truck',
      requiredVehicleEnum: VehicleType.DUMP_TRUCK,

      rate: 180,
      pricePerTonne: 12,
      currency: 'EUR',

      status: TransportJobStatus.ACCEPTED,
      driverId: driver.id,
    },
  });
  console.log(`✅  DEMO-001  ACCEPTED   Jūrmala → Rīga          (driver: ${driver.email})`);

  // ── DEMO-002: AVAILABLE return trip — pickup near Rīga (delivery of DEMO-001)
  //    Rīga construction site → Ogre recycling center
  //    Pickup is 1 km from DEMO-001's delivery → perfect return trip
  await prisma.transportJob.create({
    data: {
      jobNumber: 'DEMO-002',
      jobType: TransportJobType.WASTE_COLLECTION,
      cargoType: 'Construction Waste',
      cargoWeight: 12,

      pickupAddress: 'Krasta iela 68',
      pickupCity: 'Rīga',
      pickupState: 'Rīga',
      pickupPostal: 'LV-1019',
      pickupDate: tomorrow,
      pickupWindow: '13:00–15:00',
      pickupLat: 56.9430,  // ~1 km south of DEMO-001 delivery
      pickupLng: 24.1120,

      deliveryAddress: 'Rūpniecības iela 5',
      deliveryCity: 'Ogre',
      deliveryState: 'Ogres novads',
      deliveryPostal: 'LV-5001',
      deliveryDate: tomorrow,
      deliveryWindow: '16:00–18:00',
      deliveryLat: OGRE.lat,
      deliveryLng: OGRE.lng,

      distanceKm: 55,
      requiredVehicleType: 'Hook Lift',
      requiredVehicleEnum: VehicleType.HOOK_LIFT,

      rate: 210,
      pricePerTonne: 17.5,
      currency: 'EUR',

      status: TransportJobStatus.AVAILABLE,
    },
  });
  console.log(`✅  DEMO-002  AVAILABLE  Rīga → Ogre             (return trip, 1 km from DEMO-001 delivery)`);

  // ── DEMO-003: AVAILABLE return trip — pickup near Rīga, different direction
  //    Rīga → Sigulda (gravel backhaul)
  await prisma.transportJob.create({
    data: {
      jobNumber: 'DEMO-003',
      jobType: TransportJobType.MATERIAL_DELIVERY,
      cargoType: 'Crushed Stone 16/32',
      cargoWeight: 20,

      pickupAddress: 'Pārdaugavas iela 3',
      pickupCity: 'Rīga',
      pickupState: 'Rīga',
      pickupPostal: 'LV-1002',
      pickupDate: dayAfter,
      pickupWindow: '07:00–09:00',
      pickupLat: 56.9600,  // ~1.5 km north-west of DEMO-001 delivery
      pickupLng: 24.0800,

      deliveryAddress: 'Gaujas iela 22',
      deliveryCity: 'Sigulda',
      deliveryState: 'Siguldas novads',
      deliveryPostal: 'LV-2150',
      deliveryDate: dayAfter,
      deliveryWindow: '10:00–12:00',
      deliveryLat: SIGULDA.lat,
      deliveryLng: SIGULDA.lng,

      distanceKm: 48,
      requiredVehicleType: 'Semi Trailer',
      requiredVehicleEnum: VehicleType.SEMI_TRAILER,

      rate: 240,
      pricePerTonne: 12,
      currency: 'EUR',

      status: TransportJobStatus.AVAILABLE,
    },
  });
  console.log(`✅  DEMO-003  AVAILABLE  Rīga → Sigulda          (return trip, 3 km from DEMO-001 delivery)`);

  // ── DEMO extra: a job far away — should NOT appear in 50 km return-trip radius
  await prisma.transportJob.deleteMany({ where: { jobNumber: 'DEMO-004' } });
  await prisma.transportJob.create({
    data: {
      jobNumber: 'DEMO-004',
      jobType: TransportJobType.MATERIAL_DELIVERY,
      cargoType: 'Gravel',
      cargoWeight: 18,

      pickupAddress: 'Lielā iela 1',
      pickupCity: 'Jelgava',
      pickupState: 'Jelgavas novads',
      pickupPostal: 'LV-3001',
      pickupDate: dayAfter,
      pickupWindow: '09:00–11:00',
      pickupLat: JELGAVA.lat,
      pickupLng: JELGAVA.lng,

      deliveryAddress: 'Mežciema iela 9',
      deliveryCity: 'Rīga',
      deliveryState: 'Rīga',
      deliveryPostal: 'LV-1084',
      deliveryDate: dayAfter,
      deliveryWindow: '13:00–15:00',
      deliveryLat: RIGA.lat,
      deliveryLng: RIGA.lng,

      distanceKm: 44,
      requiredVehicleType: 'Dump Truck',
      requiredVehicleEnum: VehicleType.DUMP_TRUCK,

      rate: 195,
      pricePerTonne: 10.8,
      currency: 'EUR',

      status: TransportJobStatus.AVAILABLE,
    },
  });
  console.log(`✅  DEMO-004  AVAILABLE  Jelgava → Rīga          (far away — appears in job board, not return trips)`);

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  Demo jobs seeded!                                          │
│                                                             │
│  Log in as driver@demo.com  (password: Demo1234!)           │
│  → Active tab   : DEMO-001 map  Jūrmala → Rīga             │
│  → Jobs tab     : toggle "Tukšbrauciens" (Avoid Empty Runs) │
│                   → DEMO-002 & DEMO-003 appear (~1-3 km)   │
│                   → DEMO-004 is listed only in job board    │
└─────────────────────────────────────────────────────────────┘
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
