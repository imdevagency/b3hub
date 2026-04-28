const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const o = await prisma.order.findFirst({ orderBy: { createdAt: 'desc'} });
  console.log('Order:', o?.id);
  prisma.$disconnect();
}
test();
