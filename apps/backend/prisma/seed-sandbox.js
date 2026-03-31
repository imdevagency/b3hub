"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
const prisma = new client_1.PrismaClient({ adapter });
function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
async function getUser(email) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u)
        throw new Error(`User ${email} not found — run "npm run seed" first.`);
    return u;
}
async function getCompany(registrationNum) {
    const c = await prisma.company.findUnique({ where: { registrationNum } });
    if (!c)
        throw new Error(`Company ${registrationNum} not found — run "npm run seed" first.`);
    return c;
}
async function getMaterial(name, supplierId) {
    return prisma.material.findFirst({ where: { name, supplierId } });
}
async function main() {
    console.log('\n🌱  seed-sandbox — starting...\n');
    const now = new Date();
    const buyer = await getUser('buyer@demo.com');
    const seller = await getUser('seller@demo.com');
    const driver = await getUser('driver@demo.com');
    const demo = await getUser('demo@demo.com');
    const buyerCompany = await getCompany('LV40001234567');
    const supplierCompany = await getCompany('LV40003123456');
    const baltbuveCompany = await getCompany('LV40009999999');
    console.log('📦  Setting up carrier company...');
    const carrierCompany = await prisma.company.upsert({
        where: { registrationNum: 'LV40005555555' },
        update: { verified: true },
        create: {
            name: 'RīgaKargo SIA',
            legalName: 'RīgaKargo SIA',
            companyType: client_1.CompanyType.CARRIER,
            email: 'info@rigakargo.lv',
            phone: '+371 67 555 555',
            registrationNum: 'LV40005555555',
            taxId: 'LV40005555555',
            street: 'Maskavas iela 433',
            city: 'Rīga',
            state: 'Rīga',
            postalCode: 'LV-1057',
            country: 'LV',
            verified: true,
            rating: 4.7,
        },
    });
    if (!driver.companyId) {
        await prisma.user.update({
            where: { id: driver.id },
            data: {
                companyId: carrierCompany.id,
                companyRole: client_1.CompanyRole.DRIVER,
            },
        });
    }
    console.log(`  ✅  Carrier: ${carrierCompany.name}`);
    const skipPrices = [
        { skipSize: 'MINI', price: 85 },
        { skipSize: 'MIDI', price: 125 },
        { skipSize: 'BUILDERS', price: 165 },
        { skipSize: 'LARGE', price: 195 },
    ];
    for (const sp of skipPrices) {
        await prisma.carrierPricing.upsert({
            where: { carrierId_skipSize: { carrierId: carrierCompany.id, skipSize: sp.skipSize } },
            update: { price: sp.price },
            create: {
                carrierId: carrierCompany.id,
                skipSize: sp.skipSize,
                price: sp.price,
                currency: 'EUR',
            },
        });
    }
    const zones = [
        { city: 'Rīga', surcharge: 0 },
        { city: 'Jūrmala', surcharge: 10 },
        { city: 'Ogre', surcharge: 15 },
        { city: 'Salaspils', surcharge: 5 },
        { city: 'Mārupe', surcharge: 5 },
        { city: 'Ādaži', surcharge: 8 },
    ];
    for (const zone of zones) {
        const existing = await prisma.carrierServiceZone.findFirst({
            where: { carrierId: carrierCompany.id, city: zone.city },
        });
        if (!existing) {
            await prisma.carrierServiceZone.create({
                data: { carrierId: carrierCompany.id, ...zone },
            });
        }
    }
    console.log(`  ✅  CarrierPricing + ${zones.length} service zones`);
    console.log('\n🚛  Seeding vehicles...');
    const vehicles = [
        {
            make: 'Scania',
            model: 'G450',
            year: 2021,
            licensePlate: 'LV-KRG-001',
            vehicleType: client_1.VehicleType.DUMP_TRUCK,
            capacity: 22,
            status: client_1.VehicleStatus.ACTIVE,
        },
        {
            make: 'Volvo',
            model: 'FH16',
            year: 2019,
            licensePlate: 'LV-KRG-002',
            vehicleType: client_1.VehicleType.SKIP_LOADER,
            capacity: 18,
            status: client_1.VehicleStatus.ACTIVE,
        },
        {
            make: 'MAN',
            model: 'TGS 26.440',
            year: 2022,
            licensePlate: 'LV-KRG-003',
            vehicleType: client_1.VehicleType.DUMP_TRUCK,
            capacity: 20,
            status: client_1.VehicleStatus.IN_USE,
        },
    ];
    const createdVehicles = [];
    for (const v of vehicles) {
        const veh = await prisma.vehicle.upsert({
            where: { licensePlate: v.licensePlate },
            update: {},
            create: { ...v, companyId: carrierCompany.id },
        });
        createdVehicles.push(veh);
        console.log(`  ✅  ${v.make} ${v.model} (${v.licensePlate})`);
    }
    console.log('\n📋  Seeding orders...');
    const sand = await getMaterial('Smiltis (Frakcija 0-4 mm)', supplierCompany.id);
    const gravel = await getMaterial('Šķembas (Frakcija 8-16 mm)', supplierCompany.id);
    const stone = await getMaterial('Dolomīts (Frakcija 16-32 mm)', supplierCompany.id);
    const orderSeeds = [
        {
            orderNumber: 'ORD-2024-001',
            orderType: 'MATERIAL',
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            deliveryDate: addDays(now, -14),
            subtotal: 380,
            tax: 79.80,
            deliveryFee: 45,
            total: 504.80,
            material: sand,
            qty: 40,
        },
        {
            orderNumber: 'ORD-2024-002',
            orderType: 'MATERIAL',
            status: 'IN_PROGRESS',
            paymentStatus: 'AUTHORIZED',
            deliveryDate: addDays(now, 2),
            subtotal: 600,
            tax: 126,
            deliveryFee: 55,
            total: 781,
            material: gravel,
            qty: 50,
        },
        {
            orderNumber: 'ORD-2024-003',
            orderType: 'MATERIAL',
            status: 'CONFIRMED',
            paymentStatus: 'PENDING',
            deliveryDate: addDays(now, 7),
            subtotal: 290,
            tax: 60.90,
            deliveryFee: 45,
            total: 395.90,
            material: stone,
            qty: 20,
        },
        {
            orderNumber: 'ORD-2024-004',
            orderType: 'MATERIAL',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            deliveryDate: addDays(now, 14),
            subtotal: 190,
            tax: 39.90,
            deliveryFee: 35,
            total: 264.90,
            material: sand,
            qty: 20,
        },
        {
            orderNumber: 'ORD-2024-005',
            orderType: 'MATERIAL',
            status: 'CANCELLED',
            paymentStatus: 'REFUNDED',
            deliveryDate: addDays(now, -5),
            subtotal: 144,
            tax: 30.24,
            deliveryFee: 35,
            total: 209.24,
            material: gravel,
            qty: 12,
        },
    ];
    const createdOrders = [];
    for (const os of orderSeeds) {
        const existing = await prisma.order.findUnique({ where: { orderNumber: os.orderNumber } });
        if (existing) {
            createdOrders.push(existing);
            continue;
        }
        const order = await prisma.order.create({
            data: {
                orderNumber: os.orderNumber,
                orderType: os.orderType,
                buyerId: buyerCompany.id,
                createdById: buyer.id,
                deliveryAddress: 'Brīvības iela 55',
                deliveryCity: 'Rīga',
                deliveryState: 'Rīga',
                deliveryPostal: 'LV-1010',
                deliveryDate: os.deliveryDate,
                deliveryWindow: '08:00–12:00',
                subtotal: os.subtotal,
                tax: os.tax,
                deliveryFee: os.deliveryFee,
                total: os.total,
                currency: 'EUR',
                status: os.status,
                paymentStatus: os.paymentStatus,
                siteContactName: 'Jānis Bērziņš',
                siteContactPhone: '+371 20 111 001',
                ...(os.material
                    ? {
                        items: {
                            create: {
                                materialId: os.material.id,
                                quantity: os.qty,
                                unit: 'TONNE',
                                unitPrice: os.subtotal / os.qty,
                                total: os.subtotal,
                            },
                        },
                    }
                    : {}),
            },
        });
        createdOrders.push(order);
        console.log(`  ✅  ${os.orderNumber} (${os.status})`);
    }
    console.log('\n🚛  Seeding transport jobs...');
    const jobStatuses = [
        { orderNum: 'ORD-2024-001', jobNum: 'TJ-2024-001', status: 'DELIVERED' },
        { orderNum: 'ORD-2024-002', jobNum: 'TJ-2024-002', status: 'EN_ROUTE_DELIVERY' },
        { orderNum: 'ORD-2024-003', jobNum: 'TJ-2024-003', status: 'ASSIGNED' },
    ];
    for (const js of jobStatuses) {
        const order = createdOrders.find((o) => o.orderNumber === js.orderNum);
        if (!order)
            continue;
        const existing = await prisma.transportJob.findUnique({ where: { jobNumber: js.jobNum } });
        if (existing)
            continue;
        await prisma.transportJob.create({
            data: {
                jobNumber: js.jobNum,
                jobType: client_1.TransportJobType.MATERIAL_DELIVERY,
                orderId: order.id,
                carrierId: carrierCompany.id,
                driverId: driver.id,
                vehicleId: createdVehicles[0]?.id,
                cargoType: 'Celtniecības materiāls',
                cargoWeight: 20,
                pickupAddress: 'Smilšu iela 12',
                pickupCity: 'Rīga',
                pickupState: 'Rīga',
                pickupPostal: 'LV-1001',
                pickupDate: addDays(order.deliveryDate ?? now, -1),
                pickupWindow: '06:00–08:00',
                pickupLat: 56.9496,
                pickupLng: 24.1052,
                deliveryAddress: order.deliveryAddress,
                deliveryCity: order.deliveryCity,
                deliveryState: order.deliveryState,
                deliveryPostal: order.deliveryPostal,
                deliveryDate: order.deliveryDate ?? now,
                deliveryWindow: '08:00–12:00',
                deliveryLat: 56.951,
                deliveryLng: 24.113,
                distanceKm: 8.4,
                rate: order.deliveryFee,
                currency: 'EUR',
                status: js.status,
                requiredVehicleEnum: client_1.VehicleType.DUMP_TRUCK,
            },
        });
        console.log(`  ✅  ${js.jobNum} (${js.status})`);
    }
    console.log('\n🗑️   Seeding skip hire orders...');
    const skipOrders = [
        {
            orderNumber: 'SKP-2024-001',
            skipSize: 'MIDI',
            wasteCategory: 'MIXED',
            status: 'COMPLETED',
            location: 'Rīga, LV-1010',
            daysOffset: -21,
            price: 125,
        },
        {
            orderNumber: 'SKP-2024-002',
            skipSize: 'BUILDERS',
            wasteCategory: 'CONCRETE_RUBBLE',
            status: 'DELIVERED',
            location: 'Jūrmala, LV-2015',
            daysOffset: -3,
            price: 175,
        },
        {
            orderNumber: 'SKP-2024-003',
            skipSize: 'MINI',
            wasteCategory: 'GREEN_GARDEN',
            status: 'CONFIRMED',
            location: 'Rīga, LV-1001',
            daysOffset: 2,
            price: 95,
        },
        {
            orderNumber: 'SKP-2024-004',
            skipSize: 'LARGE',
            wasteCategory: 'WOOD',
            status: 'PENDING',
            location: 'Salaspils, LV-2121',
            daysOffset: 7,
            price: 195,
        },
    ];
    for (const sk of skipOrders) {
        const existing = await prisma.skipHireOrder.findUnique({
            where: { orderNumber: sk.orderNumber },
        });
        if (existing)
            continue;
        await prisma.skipHireOrder.create({
            data: {
                orderNumber: sk.orderNumber,
                location: sk.location,
                wasteCategory: sk.wasteCategory,
                skipSize: sk.skipSize,
                deliveryDate: addDays(now, sk.daysOffset),
                price: sk.price,
                currency: 'EUR',
                status: sk.status,
                carrierId: carrierCompany.id,
                userId: buyer.id,
                contactName: 'Jānis Bērziņš',
                contactEmail: 'buyer@demo.com',
                contactPhone: '+371 20 111 001',
                lat: 56.9496,
                lng: 24.1052,
            },
        });
        console.log(`  ✅  ${sk.orderNumber} (${sk.skipSize} – ${sk.status})`);
    }
    console.log('\n💬  Seeding quote requests...');
    const quoteSeeds = [
        {
            requestNumber: 'RFQ-2024-001',
            materialCategory: client_1.MaterialCategory.SAND,
            materialName: 'Smiltis 0-4 mm',
            quantity: 80,
            unit: client_1.MaterialUnit.TONNE,
            status: client_1.QuoteRequestStatus.QUOTED,
            deliveryCity: 'Rīga',
            deliveryAddress: 'Brīvības iela 55, Rīga',
            withResponse: true,
            responsePrice: 8.80,
        },
        {
            requestNumber: 'RFQ-2024-002',
            materialCategory: client_1.MaterialCategory.GRAVEL,
            materialName: 'Šķembas 8-16 mm',
            quantity: 120,
            unit: client_1.MaterialUnit.TONNE,
            status: client_1.QuoteRequestStatus.PENDING,
            deliveryCity: 'Jūrmala',
            deliveryAddress: 'Jūras iela 3, Jūrmala',
            withResponse: false,
            responsePrice: 0,
        },
        {
            requestNumber: 'RFQ-2024-003',
            materialCategory: client_1.MaterialCategory.SOIL,
            materialName: 'Melnzeme dārzam',
            quantity: 15,
            unit: client_1.MaterialUnit.M3,
            status: client_1.QuoteRequestStatus.ACCEPTED,
            deliveryCity: 'Ogre',
            deliveryAddress: 'Brīvības iela 1, Ogre',
            withResponse: true,
            responsePrice: 17.50,
        },
    ];
    for (const rq of quoteSeeds) {
        const existing = await prisma.quoteRequest.findUnique({
            where: { requestNumber: rq.requestNumber },
        });
        if (existing)
            continue;
        const qr = await prisma.quoteRequest.create({
            data: {
                requestNumber: rq.requestNumber,
                buyerId: buyer.id,
                materialCategory: rq.materialCategory,
                materialName: rq.materialName,
                quantity: rq.quantity,
                unit: rq.unit,
                deliveryAddress: rq.deliveryAddress,
                deliveryCity: rq.deliveryCity,
                status: rq.status,
                notes: 'Nepieciešams piegādāt pilnā apjomā.',
            },
        });
        if (rq.withResponse && rq.responsePrice > 0) {
            await prisma.quoteResponse.create({
                data: {
                    requestId: qr.id,
                    supplierId: supplierCompany.id,
                    pricePerUnit: rq.responsePrice,
                    totalPrice: rq.responsePrice * rq.quantity,
                    unit: rq.unit,
                    etaDays: 3,
                    notes: 'Varam piegādāt 3 darba dienu laikā.',
                    status: rq.status === client_1.QuoteRequestStatus.ACCEPTED
                        ? client_1.QuoteResponseStatus.ACCEPTED
                        : client_1.QuoteResponseStatus.PENDING,
                    validUntil: addDays(now, 14),
                },
            });
        }
        console.log(`  ✅  ${rq.requestNumber} (${rq.status})`);
    }
    console.log('\n📑  Seeding framework contracts...');
    const existingFC = await prisma.frameworkContract.findUnique({
        where: { contractNumber: 'FC-2024-001' },
    });
    if (!existingFC) {
        const fc = await prisma.frameworkContract.create({
            data: {
                contractNumber: 'FC-2024-001',
                title: 'Celtniecības materiālu piegāde 2024–2025',
                buyerId: buyerCompany.id,
                supplierId: supplierCompany.id,
                createdById: buyer.id,
                status: client_1.FrameworkContractStatus.ACTIVE,
                startDate: addDays(now, -90),
                endDate: addDays(now, 275),
                notes: 'Gada iepirkuma līgums smilts, šķembas un grants piegādei.',
                positions: {
                    create: [
                        {
                            positionType: client_1.FrameworkPositionType.MATERIAL_DELIVERY,
                            description: 'Smiltis 0-4 mm',
                            agreedQty: 1000,
                            unit: 't',
                            unitPrice: 9.20,
                            pickupAddress: 'Smilšu iela 12',
                            pickupCity: 'Rīga',
                            deliveryAddress: 'Brīvības iela 55',
                            deliveryCity: 'Rīga',
                        },
                        {
                            positionType: client_1.FrameworkPositionType.MATERIAL_DELIVERY,
                            description: 'Šķembas 8-16 mm',
                            agreedQty: 500,
                            unit: 't',
                            unitPrice: 11.50,
                            pickupAddress: 'Smilšu iela 12',
                            pickupCity: 'Rīga',
                            deliveryAddress: 'Brīvības iela 55',
                            deliveryCity: 'Rīga',
                        },
                    ],
                },
            },
        });
        console.log(`  ✅  ${fc.contractNumber}: ${fc.title}`);
    }
    console.log('\n🧾  Seeding invoices...');
    const invoiceOrders = createdOrders.filter((o) => ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS'].includes(o.status));
    let invNum = 1001;
    for (const order of invoiceOrders) {
        const existing = await prisma.invoice.findFirst({ where: { orderId: order.id } });
        if (existing)
            continue;
        await prisma.invoice.create({
            data: {
                invoiceNumber: `INV-2024-${invNum++}`,
                orderId: order.id,
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total,
                currency: 'EUR',
                dueDate: addDays(order.deliveryDate ?? now, 30),
                paidDate: order.status === 'COMPLETED' ? addDays(order.deliveryDate ?? now, 5) : null,
                paymentStatus: order.paymentStatus,
            },
        });
        console.log(`  ✅  INV-2024-${invNum - 1} for ${order.orderNumber}`);
    }
    console.log('\n🔔  Seeding notifications...');
    const notifSeeds = [
        {
            userId: buyer.id,
            type: client_1.NotificationType.ORDER_CONFIRMED,
            title: 'Pasūtījums apstiprināts',
            message: 'Jūsu pasūtījums ORD-2024-003 apstiprināts. Piegāde plānota 7 dienu laikā.',
            read: false,
        },
        {
            userId: buyer.id,
            type: client_1.NotificationType.TRANSPORT_STARTED,
            title: 'Piegāde ceļā',
            message: 'Šoferis Pēteris Ozoliņš ir ceļā uz jūsu objektu. Plānotais ierašanās laiks: 10:30.',
            read: false,
        },
        {
            userId: buyer.id,
            type: client_1.NotificationType.QUOTE_RECEIVED,
            title: 'Saņemts piedāvājums',
            message: 'BaltSmiltis SIA atbildēja uz jūsu pieprasījumu RFQ-2024-001 ar cenu €8.80/t.',
            read: true,
        },
        {
            userId: buyer.id,
            type: client_1.NotificationType.ORDER_DELIVERED,
            title: 'Pasūtījums piegādāts',
            message: 'ORD-2024-001 — piegāde veiksmīgi pabeigta. Lūdzu aplieciniet saņemšanu.',
            read: true,
        },
        {
            userId: seller.id,
            type: client_1.NotificationType.ORDER_CREATED,
            title: 'Jauns pasūtījums',
            message: 'RīgasBūve SIA ir iesnieguši jaunu pasūtījumu (ORD-2024-004). Lūdzu apstipriniet.',
            read: false,
        },
        {
            userId: seller.id,
            type: client_1.NotificationType.PAYMENT_RECEIVED,
            title: 'Maksājums saņemts',
            message: 'Maksājums €504.80 par pasūtījumu ORD-2024-001 ir ieskaitīts jūsu kontā.',
            read: true,
        },
        {
            userId: driver.id,
            type: client_1.NotificationType.TRANSPORT_ASSIGNED,
            title: 'Jauns brauciens',
            message: 'Jums piešķirts jauns brauciens TJ-2024-003. Iekraušana rīt 06:00 Smilšu ielā 12.',
            read: false,
        },
        {
            userId: driver.id,
            type: client_1.NotificationType.TRANSPORT_COMPLETED,
            title: 'Brauciens pabeigts',
            message: 'TJ-2024-001 veiksmīgi pabeigts. Paldies par darbu!',
            read: true,
        },
        {
            userId: demo.id,
            type: client_1.NotificationType.ORDER_CONFIRMED,
            title: 'Pasūtījums apstiprināts',
            message: 'Testēšanas pasūtījums apstiprināts. Visi notikumi darbosies normāli.',
            read: false,
        },
    ];
    let notifCount = 0;
    for (const n of notifSeeds) {
        await prisma.notification.create({ data: n });
        notifCount++;
    }
    console.log(`  ✅  ${notifCount} notifications created`);
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  seed-sandbox complete!

Demo accounts (password: Demo1234!):
  buyer@demo.com     → buyer, orders at all stages
  seller@demo.com    → supplier, materials + quote responses
  driver@demo.com    → carrier driver, active transport jobs
  demo@demo.com      → all roles (buyer + seller + carrier)
  admin@b3hub.com    → platform admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}
main()
    .catch((e) => {
    console.error('❌  seed-sandbox failed:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-sandbox.js.map