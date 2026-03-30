/**
 * Application entry point.
 * Creates the NestJS app, applies global middleware (CORS, validation pipe,
 * exception filter, rate-throttler guard) and starts the HTTP server on PORT.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for Stripe webhook signature verification
    rawBody: true,
  });

  // Increase JSON body limit to support base64-encoded photo uploads
  app.use(json({ limit: '10mb' }));

  // CORS — tight in production, open in development
  const allowedOrigin =
    process.env.ALLOWED_ORIGIN ??
    (process.env.NODE_ENV === 'production' ? false : true);
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
