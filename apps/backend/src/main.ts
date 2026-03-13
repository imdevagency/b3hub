import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// ── Startup environment validation ───────────────────────────────────────────
function validateEnv() {
  const logger = new Logger('Bootstrap');
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.warn(`⚠️  Missing recommended env vars: ${missing.join(', ')}`);
    logger.warn('   App will start but security defaults are unsafe for production.');
  }
  if (!process.env['JWT_SECRET']) {
    logger.warn('   JWT_SECRET is not set — using insecure fallback. SET THIS IN PRODUCTION!');
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // CORS — tight in production, open in development
  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? (process.env.NODE_ENV === 'production' ? false : true);
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(
    `🚀 Application is running on: http://0.0.0.0:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
