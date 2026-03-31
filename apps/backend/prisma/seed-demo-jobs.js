"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
const JURMALA = { lat: 56.9677, lng: 23.7718 };
const RIGA = { lat: 56.9496, lng: 24.1052 };
const OGRE = { lat: 56.8153, lng: 24.6037 };
const SIGULDA = { lat: 57.1534, lng: 24.86 };
const JELGAVA = { lat: 56.649, lng: 23.7124 };
async function main() {
    const driver = await prisma.user.findUnique({
        where: { email: 'driver@demo.com' },
    });
    if (!driver) {
        console.error('❌  driver@demo.com not found — run the main seed first: npm run seed');
        process.exit(1);
    }
    await prisma.transportJob.deleteMany({
        where: { jobNumber: { in: ['DEMO-001', 'DEMO-002', 'DEMO-003'] } },
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const active = await prisma.transportJob.create({
        data: {
            jobNumber: 'DEMO-001',
            jobType: client_1.TransportJobType.MATERIAL_DELIVERY,
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
            requiredVehicleEnum: client_1.VehicleType.DUMP_TRUCK,
            rate: 180,
            pricePerTonne: 12,
            currency: 'EUR',
            status: client_1.TransportJobStatus.ACCEPTED,
            driverId: driver.id,
        },
    });
    console.log(`✅  DEMO-001  ACCEPTED   Jūrmala → Rīga          (driver: ${driver.email})`);
    await prisma.transportJob.create({
        data: {
            jobNumber: 'DEMO-002',
            jobType: client_1.TransportJobType.WASTE_COLLECTION,
            cargoType: 'Construction Waste',
            cargoWeight: 12,
            pickupAddress: 'Krasta iela 68',
            pickupCity: 'Rīga',
            pickupState: 'Rīga',
            pickupPostal: 'LV-1019',
            pickupDate: tomorrow,
            pickupWindow: '13:00–15:00',
            pickupLat: 56.943,
            pickupLng: 24.112,
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
            requiredVehicleEnum: client_1.VehicleType.HOOK_LIFT,
            rate: 210,
            pricePerTonne: 17.5,
            currency: 'EUR',
            status: client_1.TransportJobStatus.AVAILABLE,
        },
    });
    console.log(`✅  DEMO-002  AVAILABLE  Rīga → Ogre             (return trip, 1 km from DEMO-001 delivery)`);
    await prisma.transportJob.create({
        data: {
            jobNumber: 'DEMO-003',
            jobType: client_1.TransportJobType.MATERIAL_DELIVERY,
            cargoType: 'Crushed Stone 16/32',
            cargoWeight: 20,
            pickupAddress: 'Pārdaugavas iela 3',
            pickupCity: 'Rīga',
            pickupState: 'Rīga',
            pickupPostal: 'LV-1002',
            pickupDate: dayAfter,
            pickupWindow: '07:00–09:00',
            pickupLat: 56.96,
            pickupLng: 24.08,
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
            requiredVehicleEnum: client_1.VehicleType.SEMI_TRAILER,
            rate: 240,
            pricePerTonne: 12,
            currency: 'EUR',
            status: client_1.TransportJobStatus.AVAILABLE,
        },
    });
    console.log(`✅  DEMO-003  AVAILABLE  Rīga → Sigulda          (return trip, 3 km from DEMO-001 delivery)`);
    await prisma.transportJob.deleteMany({ where: { jobNumber: 'DEMO-004' } });
    await prisma.transportJob.create({
        data: {
            jobNumber: 'DEMO-004',
            jobType: client_1.TransportJobType.MATERIAL_DELIVERY,
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
            requiredVehicleEnum: client_1.VehicleType.DUMP_TRUCK,
            rate: 195,
            pricePerTonne: 10.8,
            currency: 'EUR',
            status: client_1.TransportJobStatus.AVAILABLE,
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
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-demo-jobs.js.map