const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const o = await prisma.order.findFirst({ orderBy: { createdAt: 'desc'} });
  console.log('ORDER ID', o?.id);
  const found = await prisma.order.findUnique({
      where: { id: o?.id },
      include: {
        items: { include: { material: { include: { supplier: { select: { name: true, email: true, phone: true } } } } } },
        buyer: { select: { name: true, email: true, phone: true, street: true, city: true, state: true, postalCode: true } },
        transportJobs: { include: { driver: { select: { id: true, firstName: true, lastName: true, phone: true, avatar: true, driverProfile: { select: { rating: true, completedJobs: true } } } }, vehicle: { select: { id: true, licensePlate: true, vehicleType: true } }, deliveryProof: true, exceptions: { select: { id: true, type: true, status: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' } } } },
        invoices: true,
        surcharges: true,
        fieldPasses: { select: { id: true, passNumber: true, vehiclePlate: true, driverName: true, validFrom: true, validTo: true, status: true, fileUrl: true }, orderBy: { createdAt: 'desc' } },
        linkedSkipOrder: { select: { id: true, orderNumber: true, skipSize: true, wasteCategory: true, status: true, deliveryDate: true, price: true, location: true } },
      },
    });
  console.log(found ? "FOUND" : "NOT FOUND");
  prisma.$disconnect();
}
test().catch(e => console.log(e));
