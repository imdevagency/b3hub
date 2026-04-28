import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/orders/orders.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const ordersService = app.get(OrdersService);
  
  const order = await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!order) {
    console.log('NO ORDERS');
    return;
  }
  console.log('Found order:', order.id);
  
  try {
    const full = await ordersService.findOne(order.id, { userType: 'ADMIN' } as any);
    console.log('SUCCESS');
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  await app.close();
}
bootstrap();
