"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt = __importStar(require("bcrypt"));
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const password = await bcrypt.hash('Demo1234!', 10);
    const accounts = [
        {
            email: 'demo@demo.com',
            firstName: 'Demo',
            lastName: 'User',
            phone: '+371 20 000 001',
            userType: client_1.UserType.BUYER,
            isCompany: true,
            canSell: true,
            canTransport: true,
            canSkipHire: true,
        },
        {
            email: 'buyer@demo.com',
            firstName: 'Jānis',
            lastName: 'Bērziņš',
            phone: '+371 20 111 001',
            userType: client_1.UserType.BUYER,
            isCompany: true,
            canSell: false,
            canTransport: false,
        },
        {
            email: 'seller@demo.com',
            firstName: 'Anna',
            lastName: 'Kalniņa',
            phone: '+371 20 111 002',
            userType: client_1.UserType.BUYER,
            isCompany: true,
            canSell: true,
            canTransport: false,
        },
        {
            email: 'driver@demo.com',
            firstName: 'Pēteris',
            lastName: 'Ozoliņš',
            phone: '+371 20 111 003',
            userType: client_1.UserType.BUYER,
            isCompany: false,
            canSell: false,
            canTransport: true,
        },
        {
            email: 'baltbuve@demo.com',
            firstName: 'Mārtiņš',
            lastName: 'Ozols',
            phone: '+371 20 111 004',
            userType: client_1.UserType.BUYER,
            isCompany: true,
            canSell: true,
            canTransport: true,
            canSkipHire: true,
        },
        {
            email: 'admin@b3hub.com',
            firstName: 'B3Hub',
            lastName: 'Admin',
            phone: '+371 20 000 000',
            userType: client_1.UserType.ADMIN,
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
                canSkipHire: account.canSkipHire ?? false,
                isCompany: account.isCompany,
                status: client_1.UserStatus.ACTIVE,
                phone: account.phone,
            },
            create: {
                ...account,
                password,
                status: client_1.UserStatus.ACTIVE,
            },
        });
        const caps = [user.canSell ? '📦 sell' : '', user.canTransport ? '🚛 transport' : '']
            .filter(Boolean)
            .join('  ') || '🛒 buyer only';
        console.log(`✅  ${account.email.padEnd(24)} │ ${caps}`);
    }
    console.log('\n🔑 Password for all accounts: Demo1234!\n');
    const transportEmails = [
        'driver@demo.com',
        'demo@demo.com',
        'baltbuve@demo.com',
    ];
    for (const email of transportEmails) {
        const u = await prisma.user.findUnique({ where: { email } });
        if (!u)
            continue;
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
    if (sellerUser && !sellerUser.companyId) {
        await prisma.user.update({
            where: { email: 'seller@demo.com' },
            data: { companyId: demoCompany.id },
        });
    }
    console.log(`✅  Company: ${demoCompany.name} (id: ${demoCompany.id})`);
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
    console.log(`✅  Company: ${baltbuveCompany.name} (id: ${baltbuveCompany.id})`);
    const materials = [
        {
            name: 'Smiltis (Frakcija 0-4 mm)',
            description: 'Tīra kvarca smiltis celtniecībai un apzaļumošanai. Mitruma saturs < 5%.',
            category: client_1.MaterialCategory.SAND,
            subCategory: 'Kvarca smiltis',
            basePrice: 9.5,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 5,
            maxOrder: 500,
            isRecycled: false,
            quality: 'A',
        },
        {
            name: 'Šķembas (Frakcija 8-16 mm)',
            description: 'Granīta šķembas ceļu seguma pamatnei un betona maisījumiem.',
            category: client_1.MaterialCategory.GRAVEL,
            subCategory: 'Granīta šķembas',
            basePrice: 12.0,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 10,
            maxOrder: 1000,
            isRecycled: false,
            quality: 'A',
        },
        {
            name: 'Grants (Frakcija 0-32 mm)',
            description: 'Dabīgā grants ceļu pamatnēm, pagalmiem un drenāžai.',
            category: client_1.MaterialCategory.GRAVEL,
            subCategory: 'Dabīgā grants',
            basePrice: 7.8,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 5,
            maxOrder: 2000,
            isRecycled: false,
            quality: 'B',
        },
        {
            name: 'Dolomīts (Frakcija 16-32 mm)',
            description: 'Dolomīta šķembas — lieliski piemērotas ceļu pamatnei un pagalmu segumiem.',
            category: client_1.MaterialCategory.STONE,
            subCategory: 'Dolomīts',
            basePrice: 14.5,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 5,
            maxOrder: 800,
            isRecycled: false,
            quality: 'A',
        },
        {
            name: 'Melnzeme (Dārza augsne)',
            description: 'Auglīga dārza augsne ar humusa piedevu. Piemērota apzaļumošanai.',
            category: client_1.MaterialCategory.SOIL,
            subCategory: 'Dārza augsne',
            basePrice: 18.0,
            unit: client_1.MaterialUnit.M3,
            inStock: true,
            minOrder: 2,
            maxOrder: 200,
            isRecycled: false,
            quality: 'A',
        },
        {
            name: 'Oļi (Frakcija 32-64 mm)',
            description: 'Upes oļi dekoratīviem segumiem un drenāžas slāņiem.',
            category: client_1.MaterialCategory.GRAVEL,
            subCategory: 'Upes oļi',
            basePrice: 22.0,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 2,
            maxOrder: 300,
            isRecycled: false,
            quality: 'A',
        },
        {
            name: 'Pārstrādāts betons (Frakcija 0-40 mm)',
            description: 'Pārstrādāts betona materiāls ceļu un pamatņu izbūvei. Nav piemērots ekspozīcijas slānim.',
            category: client_1.MaterialCategory.RECYCLED_CONCRETE,
            subCategory: 'RC šķembas',
            basePrice: 6.0,
            unit: client_1.MaterialUnit.TONNE,
            inStock: true,
            minOrder: 10,
            maxOrder: 5000,
            isRecycled: true,
            quality: 'B',
        },
        {
            name: 'Asfalta granulāts (RAP)',
            description: 'Pārstrādāts asfalta granulāts jauna asfalta ražošanai vai ceļu pamatnei.',
            category: client_1.MaterialCategory.ASPHALT,
            subCategory: 'RAP granulāts',
            basePrice: 8.5,
            unit: client_1.MaterialUnit.TONNE,
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
//# sourceMappingURL=seed.js.map