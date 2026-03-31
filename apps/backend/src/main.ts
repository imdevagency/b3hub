/**
 * Application entry point.
 * Creates the NestJS app, applies global middleware (CORS, validation pipe,
 * exception filter, rate-throttler guard) and starts the HTTP server on PORT.
 */
// IMPORTANT: instrument.ts must be imported before anything else so Sentry
// can instrument all modules (NestJS, Prisma, HTTP) from the start.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for Stripe webhook signature verification
    rawBody: true,
  });

  // Increase JSON body limit to support base64-encoded photo uploads
  app.use(json({ limit: '10mb' }));

  // HTTP security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
  app.use(helmet());

  // CORS — tight in production, open in development
  // Reads ALLOWED_ORIGIN or CORS_ORIGIN (comma-separated list of origins)
  const rawOrigin =
    process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN;
  const allowedOrigin = rawOrigin
    ? rawOrigin.split(',').map((o) => o.trim())
    : process.env.NODE_ENV === 'production'
      ? false
      : true;
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
  const bootstrapLogger = new Logger('Bootstrap');
  bootstrapLogger.log(
    `🚀 Application is running on: http://0.0.0.0:${process.env.PORT ?? 3000}`,
  );
}
void bootstrap();
