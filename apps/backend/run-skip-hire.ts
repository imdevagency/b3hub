import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SkipHireService } from './src/skip-hire/skip-hire.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const skipHireService = app.get(SkipHireService);
  
  const order = await prisma.skipHireOrder.findFirst({ orderBy: { createdAt: 'desc' } });
  const userId = order?.userId ?? 'test-nonexistent-id';
  console.log('Testing with userId:', userId);
  
  try {
    const result = await skipHireService.findByUser(userId);
    console.log('SUCCESS, count:', result.length);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await app.close();
}
bootstrap();
